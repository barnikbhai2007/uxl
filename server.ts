import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";
import cors from "cors";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import initSqlJs from "sql.js";
const __dirname = process.cwd();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: '10mb' }));

const JWT_SECRET = process.env.JWT_SECRET || "some_random_secret_string";

// -------------------------------------------------------------
// Cloudflare R2 Upload Client
// -------------------------------------------------------------
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID || "local"}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID || "local",
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY || "local",
  },
});

async function uploadToR2(base64Data: string, mimeType: string, filename: string) {
  if (!process.env.CF_R2_ACCESS_KEY_ID) {
    console.log("No CF_R2 mock upload returning dummy URL");
    return `https://dummy-image-url.com/${filename}`;
  }
  const buffer = Buffer.from(base64Data, "base64");
  const command = new PutObjectCommand({
    Bucket: "match-evidence",
    Key: filename,
    Body: buffer,
    ContentType: mimeType || "image/jpeg",
  });
  await r2Client.send(command);
  return `${process.env.CF_R2_PUBLIC_URL}/${filename}`;
}

// -------------------------------------------------------------
// SQLite / Cloudflare D1 Database Helper
// -------------------------------------------------------------
let localDb: any = null;
let saveDbTimeout: any = null;

async function getLocalDb() {
  if (!localDb) {
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, 'local.sqlite');
    if (fs.existsSync(dbPath)) {
      const filebuffer = fs.readFileSync(dbPath);
      localDb = new SQL.Database(filebuffer);
    } else {
      localDb = new SQL.Database();
      localDb.run(`
        CREATE TABLE IF NOT EXISTS documents (
          collection TEXT,
          id TEXT,
          data TEXT,
          PRIMARY KEY (collection, id)
        );
        CREATE TABLE IF NOT EXISTS collection_meta (
          collection TEXT PRIMARY KEY,
          updated_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS news (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          content TEXT,
          category TEXT,
          matchday INTEGER,
          triggered_by TEXT,
          created_at TEXT
        );
      `);
      persistLocalDb();
    }
  }
  return localDb;
}

function persistLocalDb() {
  if (localDb) {
    const data = localDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(path.join(__dirname, 'local.sqlite'), buffer);
  }
}

function schedulePersist() {
  if (saveDbTimeout) clearTimeout(saveDbTimeout);
  saveDbTimeout = setTimeout(persistLocalDb, 1000);
}

async function runD1Query(sql: string, params: any[] = []) {
  const accountId = process.env.CF_ACCOUNT_ID;
  const dbId = process.env.CF_D1_DATABASE_ID;
  const token = process.env.CF_API_TOKEN;

  // If missing auth, just run strictly locally
  if (!accountId || accountId === "local" || !dbId || !token || token === "dummy") {
    const db = await getLocalDb();
    try {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      } else {
        db.run(sql, params);
        schedulePersist();
        return [{ success: true, changes: 1 }];
      }
    } catch (localDbErr: any) {
      console.error("Local DB Error:", localDbErr);
      throw new Error("Local DB Error: " + localDbErr.message);
    }
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });

    const rawText = await response.text();
    if (!response.ok) {
      // Intentionally return the D1 error string to user
      throw new Error(`D1 API Error: ${response.status} ${response.statusText} ${rawText}`);
    }

    const result = JSON.parse(rawText);
    if (!result.success) {
      throw new Error(`D1 Error: ${result.errors?.[0]?.message || 'Unknown'}`);
    }

    return result.result[0].results || [];
  } catch (apiError: any) {
    console.warn("D1 API Failed, throwing error to surface it:", apiError.message);
    throw apiError;
  }
}


// -------------------------------------------------------------
// DB API Routes
// -------------------------------------------------------------

app.post("/api/db/get", async (req, res) => {
  try {
    const { collection, id } = req.body;
    const results = await runD1Query("SELECT * FROM documents WHERE collection = ? AND id = ?", [collection, id]);
    res.json({ success: true, data: results[0] || null });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/db/query", async (req, res) => {
  try {
    const { collectionName, filters = [] } = req.body;
    let sql = "SELECT * FROM documents WHERE collection = ?";
    let params: any[] = [collectionName];

    for (const f of filters) {
      if (f.op === "==") {
        sql += ` AND json_extract(data, '$.${f.field}') = ?`;
        params.push(f.value);
      }
    }

    const results = await runD1Query(sql, params);
    res.json({ success: true, data: results });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/db/set", async (req, res) => {
  try {
    const { collection, id, data } = req.body;
    const dataStr = JSON.stringify(data);
    await runD1Query(
      "INSERT INTO documents (collection, id, data) VALUES (?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data",
      [collection, id, dataStr]
    );
    res.json({ success: true });
  } catch (e: any) {
    console.error("/api/db/set Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/db/update", async (req, res) => {
  try {
    const { collection, id, data } = req.body;
    // We fetch existing data first to merge
    const oldRows = await runD1Query("SELECT data FROM documents WHERE collection = ? AND id = ?", [collection, id]);
    if (oldRows.length === 0) {
      return res.status(404).json({ success: false, error: "Document not found for update" });
    }
    const oldData = JSON.parse(oldRows[0].data);
    const newDataStr = JSON.stringify({ ...oldData, ...data });

    await runD1Query(
      "UPDATE documents SET data = ? WHERE collection = ? AND id = ?",
      [newDataStr, collection, id]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete("/api/db/delete", async (req, res) => {
  try {
    const { collection, id } = req.body;
    await runD1Query("DELETE FROM documents WHERE collection = ? AND id = ?", [collection, id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/api/db/meta/:collection", async (req, res) => {
  try {
    const { collection } = req.params;
    const results = await runD1Query("SELECT updated_at FROM collection_meta WHERE collection = ?", [collection]);
    res.json({ success: true, updated_at: results[0]?.updated_at || null });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/db/bump_meta", async (req, res) => {
  try {
    const { collection } = req.body;
    const now = Date.now();
    await runD1Query(
      "INSERT INTO collection_meta (collection, updated_at) VALUES (?, ?) ON CONFLICT(collection) DO UPDATE SET updated_at = excluded.updated_at",
      [collection, now]
    );
    res.json({ success: true, updated_at: now });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// -------------------------------------------------------------
// Auth Routes
// -------------------------------------------------------------
app.post("/api/auth/login", (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD || "Broken@2000";
  const { username, password, role } = req.body;
  
  if (role === 'admin' || username === 'admin') {
    console.log("LOGIN ATTEMPT password:", password);
    if ((password || '').trim() === 'Broken@2000') {
      const display = username === 'admin' ? 'Admin' : (username || 'Admin');
      const token = jwt.sign({ uid: "admin_user", email: "admin@uxl.com", role: "admin", displayName: display }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ success: true, token, user: { uid: "admin_user", email: "admin@uxl.com", role: "admin", displayName: display } });
    } else {
      return res.status(401).json({ success: false, error: "Invalid admin password" });
    }
  }

  // Pre-made user login
  if (username) {
    const cleanName = username.replace(/\s+/g, '_').toLowerCase();
    const token = jwt.sign({ uid: `user_${cleanName}`, email: `${cleanName}@uxl.com`, role: "user", displayName: username }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ success: true, token, user: { uid: `user_${cleanName}`, email: `${cleanName}@uxl.com`, role: "user", displayName: username } });
  }

  res.status(400).json({ success: false, error: "Invalid login" });
});

app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, error: "No token" });
  
  const token = authHeader.split(" ")[1];
  try {
    const user = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, user });
  } catch (e) {
    res.status(401).json({ success: false, error: "Invalid token" });
  }
});


// -------------------------------------------------------------
// Existing Features
// -------------------------------------------------------------
async function getAiConfig() {
  return { 
    key: process.env.GROQ_API_KEY, 
    model: "meta-llama/llama-4-scout-17b-16e-instruct", 
    source: "Groq" 
  };
}

async function sendTelegramMatchResult(matchData: any, imageBase64: string, mimeType: string, motm: {fcName: string, userId: string} | null = null) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.log('[Telegram] Missing credentials, skipping');
      return;
    }

    const caption = `
🎮 *New Match Result!*

⚽ *${matchData.homePlayer || matchData.team1 || 'Home'}* ${matchData.homeScore ?? matchData.team1Score ?? 0} - ${matchData.awayScore ?? matchData.team2Score ?? 0} *${matchData.awayPlayer || matchData.team2 || 'Away'}*

📅 Matchday: ${matchData.matchday || 'N/A'}
${motm ? `⭐ Man of the Match: ${motm.fcName}` : `🏆 MOTM: ${matchData.manOfTheMatch || 'N/A'}`}

⚽ *Scorers:*
${[...(matchData.homeScorers || matchData.team1Scorers || []), ...(matchData.awayScorers || matchData.team2Scorers || [])]
  .map((s: any) => `• ${s.playerName || s.name} (${s.goals} goal${s.goals > 1 ? 's' : ''})`)
  .join('\n') || 'No scorers recorded'}

🕐 ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
    `.trim();

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const ext = mimeType.split('/')[1] || 'jpg';
    const boundary = '----TelegramBoundary' + Date.now();

    const header = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="chat_id"`,
      '',
      chatId,
      `--${boundary}`,
      `Content-Disposition: form-data; name="parse_mode"`,
      '',
      'Markdown',
      `--${boundary}`,
      `Content-Disposition: form-data; name="caption"`,
      '',
      caption,
      `--${boundary}`,
      `Content-Disposition: form-data; name="photo"; filename="match.${ext}"`,
      `Content-Type: ${mimeType}`,
      '',
      ''
    ].join('\r\n');

    const footer = `\r\n--${boundary}--`;
    const body = Buffer.concat([
      Buffer.from(header, 'utf8'),
      imageBuffer,
      Buffer.from(footer, 'utf8')
    ]);

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length.toString()
        },
        body
      }
    );

    const result = await response.json();
    if (result.ok) {
      console.log('[Telegram] ✅ Sent successfully');
    } else {
      console.error('[Telegram] ❌ Failed:', result.description);
    }
  } catch (e) {
    console.error('[Telegram] Error:', e);
  }
}

app.get("/api/test-ai", async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config.key) throw new Error("GROQ_API_KEY is not configured.");

    const groq = new Groq({ apiKey: config.key });
    
    const response = await groq.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: "Respond with only the word 'OK' if you can read this." }]
    });
    const text = response.choices[0]?.message?.content || "{}";
    
    res.json({ success: true, message: `Connected to ${config.model} successfully! AI response: ${text}`, source: config.source });
  } catch (error: any) {
    console.error("AI Test Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/analyze-match", async (req, res) => {
  try {
    const { base64, mimeType, fcName, homeGoalkeeper, awayGoalkeeper, motm } = req.body;
    const config = await getAiConfig();
    
    console.log(`[AI] Analysis Request | Model: ${config.model} | Source: ${config.source}`);
    
    if (!config.key) throw new Error("GROQ_API_KEY is not configured.");

    const groq = new Groq({ apiKey: config.key });

    const response = await groq.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` }
            },
            {
              type: "text",
              text: `Analyze this FC Mobile match result screenshot. The player reporting this is named "${fcName}".
              
              CONTEXT:
              - Home Team Goalkeeper: ${homeGoalkeeper || "Not specified"}
              - Away Team Goalkeeper: ${awayGoalkeeper || "Not specified"}

              INSTRUCTIONS:
              1. USERNAME DETECTION (CRITICAL):
                 - Home player username = large bold text TOP LEFT of screen.
                 - Away player username = large bold Latin text TOP RIGHT of screen.
                 - IGNORE all subtitle text below usernames (team names, league names, Cyrillic text, "NO LEAGUE" etc.).
                 - The username is ALWAYS Latin alphabet, never Cyrillic. 
                 - Examples: "brokenaqua", "Icebear" — NOT "збірна України 3", "KOLKATA MASTERS", or "NO LEAGUE".
              2. Identify the TWO TEAM NAMES ("team1" for Left, "team2" for Right) using the usernames detected above.
              3. Identify the Final Score in the middle. team1Score is Left, team2Score is Right.
              4. Extract GOAL SCORERS:
                 - In FC Mobile Match Summary, the screen has two distinct halves:
                   * LEFT HALF contains the Home team's details, including a list of Home goal scorers, accompanied by Goal icons (soccer ball) and minutes (e.g. 18').
                   * RIGHT HALF contains the Away team's details, including a list of Away goal scorers, accompanied by Goal icons (soccer ball) and minutes (e.g. 54').
                 - Scan both halves of the screen carefully. Player Names under the Left (Home) team belong to "team1". Player Names under the Right (Away) team belong to "team2".
                 - DO NOT MIX THEM UP. Left-side scorers are strictly "team1", and Right-side scorers are strictly "team2".
                 - FOLLOW THE CRITICAL SCORER ASSIGNMENT RULES BELOW.
              5. Extract Match Stats: Possession, Shots, Shots on Target, Pass Accuracy, Fouls, Offsides, Saves.
                 - For "Shots (On Goal)" like "6(6)": 'shots' is 6, 'shotsOnTarget' is 6.
                 - Left-side values = "team1Stats".
                 - Right-side values = "team2Stats".
              6. MAN OF THE MATCH (MOTM): Look at the player ratings or for a player highlighted with a Star Icon or "MVP". Assign their name to "manOfTheMatch". IF NOT EXPLICITLY SHOWN, just pick the player with the most goals from the winning team (if they scored multiple goals). Otherwise, leave it as null.
              
              CRITICAL SCORER ASSIGNMENT RULES:
              1. Goals listed on the Left-side half of the screenshot are scored by the Left-side player/team (team1).
              2. Goals listed on the Right-side half of the screenshot are scored by the Right-side player/team (team2).
              3. Verify the final score:
                 - If team1Score is 3, exactly 3 goals must contain team1 scorers.
                 - If team2Score is 2, exactly 2 goals must contain team2 scorers.
              4. If a player is listed on the Left side, their "team" field MUST be "team1". If listed on the Right side, their "team" field MUST be "team2".
              5. The sum of goals for team1 scorers MUST equal team1Score, and the sum of goals for team2 scorers MUST equal team2Score.
              6. Under no circumstances should you assign a left-side scorer to "team2", or a right-side scorer to "team1".
              7. team1 = the LEFT side player (home), team2 = the RIGHT side player (away).
              8. Double check: count team1 scorers = team1Score, count team2 scorers = team2Score.

              CRITICAL RULES:
              - ALWAYS USE STRICTLY "team1" OR "team2" in the "team" field of each scorer.
              - Ensure "team1Score" matches the total number of goals in the "team1" scorers list.
              - One team must match or contain "${fcName}".
              
              Return JSON in this exact structure, ONLY the raw JSON object, no markdown, no backticks, no explanation.
              CRITICAL: The "scorers" array must have ALL goals assigned.
              { 
                "team1": "string", "team2": "string", 
                "team1Score": number, "team2Score": number, 
                "scorers": [{ "name": "string", "team": "team1"|"team2", "minute": number, "goals": 1 }],
                "team1Stats": { "possession": number, "shots": number, "shotsOnTarget": number, "passAccuracy": number, "fouls": number, "offsides": number, "saves": number },
                "team2Stats": { "possession": number, "shots": number, "shotsOnTarget": number, "passAccuracy": number, "fouls": number, "offsides": number, "saves": number },
                "manOfTheMatch": "string"
              }`
            }
          ]
        }
      ]
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const resultParsed = JSON.parse(clean);
    console.log("AI Match Analysis Output:", JSON.stringify(resultParsed, null, 2));
    if (resultParsed.error) {
        throw new Error(resultParsed.error);
    }
    
    const matchData = resultParsed.matchData || resultParsed;

    // Achievement Logic using Cloudflare D1
    const checkAndAwardAchievements = async (playerFcName: string, data: any) => {
      try {
        const regRows = await runD1Query(
          "SELECT data FROM documents WHERE collection = 'registrations' AND json_extract(data, '$.fcName') = ? LIMIT 1",
          [playerFcName]
        );
        
        if (!regRows || regRows.length === 0) return null;
        const regDoc = JSON.parse(regRows[0].data);
        const userId = regDoc.userId;
        
        const userRows = await runD1Query("SELECT data FROM documents WHERE collection = 'users' AND id = ?", [userId]);
        const userData = userRows[0] ? JSON.parse(userRows[0].data) : { achievements: {} };
        const unlockedIds = new Set(Object.keys(userData.achievements || {}));
        
        const newAchievements: string[] = [];
        const award = (id: string) => {
          if (!unlockedIds.has(id)) {
            newAchievements.push(id);
            unlockedIds.add(id);
          }
        };

        const isTeam1 = (data.team1?.toLowerCase().includes(playerFcName.toLowerCase()) || playerFcName?.toLowerCase().includes(data.team1?.toLowerCase()));
        
        const playerStats = isTeam1 ? data.team1Stats : data.team2Stats;
        const oppStats = isTeam1 ? data.team2Stats : data.team1Stats;
        const playerScore = isTeam1 ? (data.team1Score ?? 0) : (data.team2Score ?? 0);
        const oppScore = isTeam1 ? (data.team2Score ?? 0) : (data.team1Score ?? 0);
        
        const allScorers = data.scorers || [];
        const playerTeamKey = isTeam1 ? 'team1' : 'team2';
        
        const normalizeTeam = (t: string) => (t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const playerScorers = allScorers.filter((s:any) => normalizeTeam(s.team) === normalizeTeam(playerTeamKey));
        const oppScorers = allScorers.filter((s:any) => normalizeTeam(s.team) !== normalizeTeam(playerTeamKey));

        if (playerScore > oppScore) {
           award('first_blood');
           if (oppScore === 0) award('clean_sheet_king');
           if (playerScore >= 3 && oppScore >= 3) award('thriller');
        } else if (playerScore === oppScore) {
           if (playerScore >= 3) award('thriller');
        }

        if (oppScore >= 5) award('goalkeeper_nightmare');

        const groupedPlayerScorers: Record<string, { totalGoals: number, name: string }> = {};
        playerScorers.forEach((s: any) => {
          const name = s.name || s.playerName || 'Unknown';
          if (!groupedPlayerScorers[name]) {
            groupedPlayerScorers[name] = { totalGoals: 0, name };
          }
          groupedPlayerScorers[name].totalGoals += Number(s.goals || 1);
        });

        Object.values(groupedPlayerScorers).forEach((ps: any) => {
          if (ps.totalGoals >= 3) award('hat_trick_hero');
          if (ps.totalGoals >= 5) award('sniper');
        });

        playerScorers.forEach((s: any) => {
          if (s.name && s.name.includes('(OG)')) award('uno_reversed');
          
          const times = (s.minute !== undefined ? [s.minute] : String(s.time || '').split(',').map((t:string) => parseInt(t.trim().replace("'", "")))).filter(t => !isNaN(Number(t))).map(t => Number(t));
          times.forEach((t:number) => {
            if (t >= 90) award('last_minute_hero');
            if (t === 67) award('lover_67');
            if (t === 69) award('lover_69');
          });
        });

        oppScorers.forEach((s: any) => {
          const times = (s.minute !== undefined ? [s.minute] : String(s.time || '').split(',').map((t:string) => parseInt(t.trim().replace("'", "")))).filter(t => !isNaN(Number(t))).map(t => Number(t));
          times.forEach((t:number) => {
            if (t >= 90) award('heartbreak_90');
          });
        });

        if (playerStats && playerStats.saves >= 10) award('spider_man');
        if (oppStats && oppStats.shotsOnTarget !== undefined && oppStats.shotsOnTarget === 0) award('fort_knox');

        if (newAchievements.length > 0) {
          const nextAchievements = { ...(userData.achievements || {}) };
          newAchievements.forEach(id => {
             nextAchievements[id] = {
               unlockedAt: new Date().toISOString(),
               seen: false
             };
          });
          
          const newDataStr = JSON.stringify({ ...userData, achievements: nextAchievements });
          await runD1Query("UPDATE documents SET data = ? WHERE collection = 'users' AND id = ?", [newDataStr, userId]);
          return newAchievements;
        }
        return [];
      } catch (e) {
        console.error("Error in checkAndAwardAchievements:", e);
        return [];
      }
    };

    await checkAndAwardAchievements(fcName, matchData);
    
    const opponentName = (matchData.team1?.toLowerCase().includes(fcName.toLowerCase()) || fcName.toLowerCase().includes(matchData.team1?.toLowerCase()))
      ? matchData.team2
      : matchData.team1;
    
    if (opponentName) {
      await checkAndAwardAchievements(opponentName, matchData);
    }

    let publicImageUrl = null;
    try {
      const ext = (mimeType && mimeType.includes('png')) ? 'png' : 'jpg';
      const fileName = `report_${Date.now()}_${crypto.randomUUID()}.${ext}`;
      publicImageUrl = await uploadToR2(base64, mimeType, fileName);
    } catch (err) {
      console.error("Storage upload exception:", err);
    }

    console.log('[Telegram] Sending match result...');
    await sendTelegramMatchResult(matchData, base64, mimeType, motm);

    // Save report to D1
    try {
      const reportData = {
        matchData: {
          ...matchData,
          reporterName: fcName || 'Unknown Player'
        },
        reporterName: fcName || 'Unknown Player',
        timestamp: new Date().toISOString(),
        imageUrl: publicImageUrl,
        mimeType: mimeType || 'image/jpeg',
        matchId: matchData.matchId || null,
        motm: motm || null,
        analysisSummary: `Verified match between ${matchData.team1} and ${matchData.team2} (Reported by ${fcName || 'Unknown'})`
      };
      
      const newId = crypto.randomUUID();
      await runD1Query(
        "INSERT INTO documents (collection, id, data) VALUES (?, ?, ?)",
        ['reports', newId, JSON.stringify(reportData)]
      );
    } catch (saveError) {
      console.error("Failed to save report to database:", saveError);
    }
    
    res.json({ success: true, matchData, evidenceUrl: publicImageUrl });
  } catch (error: any) {
    console.error("AI Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/admin-ai-command", async (req, res) => {
  try {
    const { command, teams } = req.body;
    const config = await getAiConfig();

    console.log(`[AI] Admin Command | Model: ${config.model} | Source: ${config.source}`);
    
    if (!config.key) throw new Error("GROQ_API_KEY is not configured.");

    const groq = new Groq({ apiKey: config.key });
    
    const teamsStr = teams && Array.isArray(teams) 
        ? teams.map((t: any) => `ID: "${t.id}", Names: ["${t.name}", "${t.fcName}"]`).join(' | ')
        : 'No teams available';

    const response = await groq.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "user",
          content: `You are a Tournament Data Extractor AI. You must return ONLY a JSON array of commands.
            Each command must be an object with "type" and "data" keys.
            
            Today's date is ${new Date().toDateString()}.

            Registered Teams Reference (Find the Team ID by looking at the name or fcName):
            ${teamsStr}

            IF THE USER ASKS TO CREATE/SET MATCHES, FOR EVERY MATCH MENTIONED, OUTPUT:
            { 
              "type": "UPDATE_MATCH", 
              "data": { 
                "matchId": "generate_unique_string_like_match-12345", 
                "homeTeamId": "EXACT TEAM ID FROM REFERENCE LIST", 
                "awayTeamId": "EXACT TEAM ID FROM REFERENCE LIST", 
                "homeScore": 0, 
                "awayScore": 0, 
                "status": "scheduled", 
                "date": "Parsed Date String, e.g. May 4", 
                "matchNumber": 1, 
                "matchday": 1 
              } 
            }
            
            CRITICAL RULES:
            1. If the user gives you N matches, your array MUST contain exactly N "UPDATE_MATCH" objects. Do NOT stop, do NOT summarize.
            2. DO NOT HALUCINATE TEAM IDs. You MUST use the 'ID' corresponding to the "Names" given in the reference. If you cannot find a team, use the name the user provided as the ID.
            3. Respect Home and Away perfectly. The first team mentioned usually is home if it says "at home". Read carefully!
            4. If the user provides a specific date (like "May 4"), apply that EXPLICIT EXACT date string to the \`date\` field of EVERY match scheduled for that day.
            5. DO NOT truncate.
            
            User Command: ${command}`
        }
      ]
    });

    const text = response.choices[0]?.message?.content || "[]";
    console.log("AI Raw Response:", text);
    
    const commands = JSON.parse(text);
    res.json({ success: true, commands });
  } catch (error: any) {
    console.error("AI Admin Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/vote", async (req, res) => {
  try {
    res.json({ success: true, message: "Vote attempt logged" });
  } catch (error: any) {
    res.status(200).json({ success: false, error: "Internal server error", details: error.message });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    const results = await runD1Query("SELECT * FROM news ORDER BY created_at DESC LIMIT 20");
    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Error fetching news:", error);
    res.status(500).json({ success: false, error: "Internal server error", details: error.message });
  }
});

app.delete("/api/news/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await runD1Query("DELETE FROM news WHERE id = ?", [id]);
    res.json({ success: true, message: "News deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting news:", error);
    res.status(500).json({ success: false, error: "Internal server error", details: error.message });
  }
});

async function handleNewsGeneration(matchData: any, leagueTable: any, trigger: string) {
  const config = await getAiConfig();
  if (!config.key) throw new Error("GROQ_API_KEY is not configured.");

  const groq = new Groq({ apiKey: config.key });

  const trimmedMatch = matchData ? {
    homePlayer: matchData.homePlayer || matchData.team1 || matchData.homeTeam,
    awayPlayer: matchData.awayPlayer || matchData.team2 || matchData.awayTeam,
    homeScore: matchData.homeScore ?? matchData.team1Score,
    awayScore: matchData.awayScore ?? matchData.team2Score,
    scorers: [
      ...(matchData.homeScorers || []).map((s: any) => ({
        name: s.playerName || s.name,
        goals: s.goals,
        team: matchData.homePlayer || matchData.team1
      })),
      ...(matchData.awayScorers || []).map((s: any) => ({
        name: s.playerName || s.name,
        goals: s.goals,
        team: matchData.awayPlayer || matchData.team2
      }))
    ],
    manOfTheMatch: matchData.manOfTheMatch || null,
    matchday: matchData.matchday || null
  } : null;

  const response = await groq.chat.completions.create({
    model: config.model,
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `You are a savage, funny, dramatic football journalist for UXL — an FC Mobile tournament.
Write a 100 word max news article.

Match data: ${JSON.stringify(trimmedMatch)}

STRICT RULES:
- The GAMER usernames are homePlayer and awayPlayer (e.g. "Barnik", "Priyam", "Pritam") — USE THEM by name, every time
- NEVER say "the home team" or "the away team" — always use their actual username
- ALWAYS mention the MOTM player by name
- ALWAYS name the goalscorers
- If someone lost badly, ROAST them by username (e.g. "Priyam had a night to forget")
- If someone won big, HYPE them by username (e.g. "Barnik is UNSTOPPABLE")
- For matchday breakdown, mention EVERY player who played that matchday by name
- Be unpredictable — sometimes serious, sometimes savage banter

Pick ONE angle randomly:
1. 🔥 Savage match reaction — roast the loser by name, hype the winner
2. 😂 Full banter — mock the losing gamer's performance
3. 📊 Serious breakdown — tactical analysis mentioning both gamers
4. 🏆 Bold prediction — call out specific gamers by name for next match
5. 📅 Matchday recap — mention ALL gamers who played
6. 📈 Form guide — rank gamers by recent form using their names

Return ONLY this JSON with no markdown:
{"title":"...","content":"...","category":"SPICY|BANTER|ANALYSIS|PREDICTION|MATCHDAY|FORM"}`
    }]
  });

  const rawContent = response.choices[0]?.message?.content || "{}";
  const cleanContent = rawContent.replace(/```json|```/g, "").trim();
  const article = JSON.parse(cleanContent);
  
  const created_at = new Date().toISOString();
  await runD1Query(
    "INSERT INTO news (title, content, category, matchday, triggered_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [article.title, article.content, article.category, matchData?.matchday || null, trigger, created_at]
  );

  return { article };
}

app.post("/api/generate-news", async (req, res) => {
  try {
    const { matchData, leagueTable, trigger } = req.body;
    console.log(`[News] Triggered by: ${trigger}`);
    const result = await handleNewsGeneration(matchData, leagueTable, trigger);
    res.json({ success: true, article: result.article });
  } catch (e: any) {
    console.error("[News] Generation Error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get("/api/cron-news", async (req, res) => {
  try {
    const istHour = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    ).getHours();

    if (istHour >= 2 && istHour < 13) {
      return res.json({ skipped: true, reason: "Sleeping hours IST" });
    }

    const rows = await runD1Query(
      "SELECT data FROM documents WHERE collection = 'matches' AND json_extract(data, '$.status') = 'finished'"
    );

    const matchDatas = rows.map((r: any) => JSON.parse(r.data));
    const latestMatch = matchDatas.sort((a: any, b: any) => (b.matchNumber || 0) - (a.matchNumber || 0))[0];

    if (!latestMatch) {
       return res.json({ skipped: true, reason: "No finished matches found" });
    }

    const result = await handleNewsGeneration(latestMatch, null, 'cron');
    res.json({ success: true, article: result.article });
  } catch (e: any) {
    console.error("[News Cron] Error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    const server = app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    const scheduleNewsGeneration = () => {
      setInterval(async () => {
        try {
          const istHour = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
          ).getHours();

          if (istHour >= 2 && istHour < 13) return;
          
          const rows = await runD1Query(
            "SELECT data FROM documents WHERE collection = 'matches' AND json_extract(data, '$.status') = 'finished'"
          );
          const matchDatas = rows.map((r: any) => JSON.parse(r.data));
          const latestMatch = matchDatas.sort((a: any, b: any) => (b.matchNumber || 0) - (a.matchNumber || 0))[0];

          if (latestMatch) {
            await handleNewsGeneration(latestMatch, null, 'scheduler');
          }
        } catch (err) {
          console.error("[News Scheduler] Error:", err);
        }
      }, 2 * 60 * 60 * 1000); // Every 2 hours
    };

    scheduleNewsGeneration();
  }
}

startServer();

export default app;
