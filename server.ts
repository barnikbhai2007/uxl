import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";
import cors from "cors";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getAiConfig() {
  return { 
    key: process.env.GROQ_API_KEY, 
    model: "meta-llama/llama-4-scout-17b-16e-instruct", 
    source: "Groq" 
  };
}

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANT: Configure CORS to allow your Vercel frontend URL
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));

app.use(express.json({ limit: '10mb' }));

  // AI Endpoint for Testing Connection
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

  // AI Endpoint for match analysis
  app.post("/api/analyze-match", async (req, res) => {
    try {
      const { base64, mimeType, fcName, homeGoalkeeper, awayGoalkeeper } = req.body;
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
                   - In EAFC/FIFA match facts, there's usually a unified timeline on the RIGHT side indicating who scored. 
                   - Scan the entire screen to identify ANY player names accompanied by a Goal icon (soccer ball) and a minute (e.g. 18').
                   - FOLLOW THE CRITICAL SCORER ASSIGNMENT RULES BELOW.
                5. Extract Match Stats: Possession, Shots, Shots on Target, Pass Accuracy, Fouls, Offsides, Saves.
                   - For "Shots (On Goal)" like "6(6)": 'shots' is 6, 'shotsOnTarget' is 6.
                   - Left-side values = "team1Stats".
                   - Right-side values = "team2Stats".
                6. MAN OF THE MATCH (MOTM): Look at the player ratings or for a player highlighted with a Star Icon or "MVP". Assign their name to "manOfTheMatch". IF NOT EXPLICITLY SHOWN, just pick the player with the most goals from the winning team (if they scored multiple goals). Otherwise, leave it as null.
                
                CRITICAL SCORER ASSIGNMENT RULES:
                1. The scorers list on the RIGHT SIDE of the screen belongs to BOTH teams combined (unified timeline).
                2. You MUST figure out which goal belongs to which team by using the FINAL SCORE as truth:
                   - If team1Score is 3, exactly 3 goals must be assigned to team1 in the scorers list.
                   - If team2Score is 2, exactly 2 goals must be assigned to team2 in the scorers list.
                   - Total scorers must always add up to the correct score.
                3. Goals are listed in TIME ORDER (earliest first) — NOT grouped by team.
                4. To assign a goal to the correct team, use the running score logic if possible, or context clues.
                5. NEVER assign more goals to a team than their final score.
                6. If unsure which team scored a goal, assign it to the team that still needs goals to reach their final score.
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

      // Achievement Logic
      const checkAndAwardAchievements = async (playerFcName: string, data: any) => {
        try {
          const { data: regSnapshot } = await supabase.from('documents')
            .select('*')
            .eq('collection', 'registrations')
            .eq('data->>fcName', playerFcName)
            .limit(1);
          
          if (!regSnapshot || regSnapshot.length === 0) return null;
          const regDoc = regSnapshot[0].data;
          const userId = regDoc.userId;
          const { data: userDoc } = await supabase.from('documents').select('*').eq('collection', 'users').eq('id', userId).single();
          const userData = userDoc?.data || { achievements: {} };
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

          // Logic
          if (playerScore > oppScore) {
             award('first_blood');
             if (oppScore === 0) award('clean_sheet_king');
             if (playerScore >= 3 && oppScore >= 3) award('thriller');
          } else if (playerScore === oppScore) {
             if (playerScore >= 3) award('thriller');
          }

          if (oppScore >= 5) award('goalkeeper_nightmare');

          // Group player scorers by name for goal-count achievements
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
            await supabase.from('documents').update({ data: { ...userData, achievements: nextAchievements } })
               .eq('collection', 'users').eq('id', userId);
            return newAchievements;
          }
          return [];
        } catch (e) {
          console.error("Error in checkAndAwardAchievements:", e);
          return [];
        }
      };

      // Process for both participants
      await checkAndAwardAchievements(fcName, matchData);
      
      const opponentName = (matchData.team1?.toLowerCase().includes(fcName.toLowerCase()) || fcName.toLowerCase().includes(matchData.team1?.toLowerCase()))
        ? matchData.team2
        : matchData.team1;
      
      if (opponentName) {
        await checkAndAwardAchievements(opponentName, matchData);
      }

      // Save report for admin review
      try {
        const reportData = {
          matchData: {
            ...matchData,
            reporterName: fcName || 'Unknown Player'
          },
          reporterName: fcName || 'Unknown Player',
          timestamp: new Date().toISOString(),
          imageUrl: base64,
          mimeType: mimeType || 'image/jpeg',
          matchId: matchData.matchId || null,
          analysisSummary: `Verified match between ${matchData.team1} and ${matchData.team2} (Reported by ${fcName || 'Unknown'})`
        };
        await supabase.from('documents').insert({ id: crypto.randomUUID(), collection: 'reports', data: reportData });
      } catch (saveError) {
        console.error("Failed to save report to database:", saveError);
        // Don't fail the whole request just because report saving failed
      }
      
      res.json({ success: true, matchData });
    } catch (error: any) {
      console.error("AI Error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // AI Endpoint for Admin Commands
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

  // API Route for Voting (Logging and IP tracking)
  app.post("/api/vote", async (req, res) => {
    try {
      const { candidateId, matchday, voterId, userId, sessionId } = req.body;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const clientIp = Array.isArray(ip) ? ip[0] : ip;

      console.log(`Vote attempt logged: candidate=${candidateId}, voter=${voterId}, matchday=${matchday}, session=${sessionId}, ip=${clientIp}`);

      // We no longer write to Firestore from the server due to IAM cross-project issues.
      // The client handles the primary write.
      // We return success here to avoid confusing the client.
      res.json({ success: true, message: "Vote attempt logged" });
    } catch (error: any) {
      console.error("Error logging vote:", error);
      res.status(200).json({ success: false, error: "Internal server error", details: error.message });
    }
  });

  async function handleNewsGeneration(matchData: any, leagueTable: any, trigger: string) {
    console.log('[News] Supabase URL:', process.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING');
    console.log('[News] Service key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
    console.log('[News] Anon key:', process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING');

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
    console.log("[News] Raw AI response:", rawContent);
    const cleanContent = rawContent.replace(/```json|```/g, "").trim();
    const article = JSON.parse(cleanContent);
    
    console.log("[News] Article generated:", article?.title);
    
    const { data, error } = await supabase.from('news').insert({
      title: article.title,
      content: article.content,
      category: article.category,
      triggered_by: trigger,
      matchday: matchData?.matchday || null
    }).select();

    console.log('[News] Insert data:', JSON.stringify(data));
    console.log('[News] Insert error:', JSON.stringify(error));

    if (error) {
      console.error("[News] Error inserting into Supabase:", error);
      throw new Error(`Supabase insert failed: ${error.message}`);
    } else {
      console.log("[News] Successfully inserted news into Supabase:", data);
    }

    return { article, data, error };
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

      console.log("[News Cron] Triggered via /api/cron-news");
      const { data: allMatches } = await supabase
        .from('documents')
        .select('data')
        .eq('collection', 'matches')
        .eq('data->>status', 'finished');

      const latestMatch = (allMatches || [])
        .map((r: any) => r.data)
        .sort((a: any, b: any) => (b.matchNumber || 0) - (a.matchNumber || 0))[0];

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
    // Listen unconditionally unless running in Vercel.
    const server = app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    // Internal scheduler - only runs 1pm to 2am IST
    const scheduleNewsGeneration = () => {
      setInterval(async () => {
        try {
          const istHour = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
          ).getHours();

          // OFF during 2am to 1pm IST (auto scheduler only)
          if (istHour >= 2 && istHour < 13) {
            console.log(`[News Scheduler] Sleeping — IST hour ${istHour}, skipping`);
            return;
          }

          console.log(`[News Scheduler] Triggering automatic news generation (IST hour ${istHour})`);
          
          // Get latest match
          const { data: allMatches } = await supabase
            .from('documents')
            .select('data')
            .eq('collection', 'matches')
            .eq('data->>status', 'finished');

          const latestMatch = (allMatches || [])
            .map((r: any) => r.data)
            .sort((a: any, b: any) => (b.matchNumber || 0) - (a.matchNumber || 0))[0];

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

  export default app;
