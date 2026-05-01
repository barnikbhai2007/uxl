import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { GoogleGenAI, Type } from "@google/genai";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    initializeApp({
      credential: cert(JSON.parse(serviceAccount)),
      projectId: firebaseConfig.projectId
    });
  } else {
    initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
}

const db = getFirestore(
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined
);

console.log(`Firestore initialized for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);

async function getAiConfig() {
  try {
    const configSnap = await db.collection('config').doc('system').get();
    const configData = configSnap.data();
    const key = configData?.geminiApiKey || process.env.GEMINI_API_KEY;
    const model = configData?.geminiModel || "gemini-flash-latest";
    const source = configData?.geminiModel ? "Firestore" : "Environment Default";
    return { key, model, source };
  } catch (error) {
    console.error("Error fetching AI config from Firestore:", error);
    return { key: process.env.GEMINI_API_KEY, model: "gemini-flash-latest", source: "Fallback" };
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // IMPORTANT: Configure CORS to allow your Vercel frontend URL
  app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
  
  app.use(express.json({ limit: '10mb' }));

  // AI Endpoint for match analysis
  app.post("/api/analyze-match", async (req, res) => {
    try {
      const { base64, mimeType, fcName, homeGoalkeeper, awayGoalkeeper } = req.body;
      const { key, model, source } = await getAiConfig();
      
      console.log(`[AI] Analysis Request | Model: ${model} | Source: ${source}`);
      
      if (!key) throw new Error("GEMINI_API_KEY is not configured.");

      const ai = new GoogleGenAI({ apiKey: key });

      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64,
                  mimeType: mimeType
                }
              },
              {
                text: `Analyze this FC Mobile match result screenshot. The player reporting this is named "${fcName}".
                
                CONTEXT:
                - Home Team Goalkeeper: ${homeGoalkeeper || "Not specified"}
                - Away Team Goalkeeper: ${awayGoalkeeper || "Not specified"}

                INSTRUCTIONS:
                1. Identify the Home Team and Away Team names.
                2. Identify the Final Score (Home vs Away).
                3. Identify Goal Scorers (name, goals, time of goal, team). CRITICAL: Look for soccer ball icons ⚽ followed by numbers like 45', 90+2'. You MUST extract this exact minute into the "time" field for each scorer. If a player scores multiple goals, try to list them separately or combine their times like "45', 80'".
                4. Extract Match Stats (Possession, Shots, Shots on Target, Pass Accuracy, Fouls, Offsides, SAVES) for both teams.
                5. MAN OF THE MATCH: Select based on highest impact. Goalkeepers with many saves and low goals conceded are strong candidates.
                
                CRITICAL: One of the teams MUST reasonably match "${fcName}".
                If neither team matches "${fcName}", return { "error": "Reporting player name was not found as a participant in this screenshot." }.
                
                Return STRICT JSON: 
                { 
                  "homeTeam": "...", 
                  "awayTeam": "...", 
                  "homeScore": 0, 
                  "awayScore": 0, 
                  "scorers": [{"name": "...", "goals": 1, "team": "Home", "time": "45'"}], 
                  "homeStats": { "possession": 50, "shots": 0, "shotsOnTarget": 0, "passAccuracy": 0, "fouls": 0, "offsides": 0, "saves": 0 }, 
                  "awayStats": { "possession": 50, "shots": 0, "shotsOnTarget": 0, "passAccuracy": 0, "fouls": 0, "offsides": 0, "saves": 0 }, 
                  "manOfTheMatch": "..." 
                }`
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text || "{}";
      const resultParsed = JSON.parse(text);
      if (resultParsed.error) {
          throw new Error(resultParsed.error);
      }
      
      const matchData = resultParsed.matchData || resultParsed;

      // Achievement Logic
      const checkAndAwardAchievements = async (playerFcName: string, data: any) => {
        try {
          // Find the player's userId from registration
          const regSnapshot = await db.collection('registrations')
            .where('fcName', '==', playerFcName)
            .limit(1)
            .get();
          
          if (regSnapshot.empty) return null;
          const regDoc = regSnapshot.docs[0];
          const userId = regDoc.data().userId;
          const userRef = db.collection('users').doc(userId);
          const userDoc = await userRef.get();
          const userData = userDoc.data() || { achievements: {} };
          const unlockedIds = new Set(Object.keys(userData.achievements || {}));
          
          const newAchievements: string[] = [];
          const award = (id: string) => {
            if (!unlockedIds.has(id)) {
              newAchievements.push(id);
              unlockedIds.add(id);
            }
          };

          const isHome = data.homeTeam?.toLowerCase().includes(playerFcName.toLowerCase()) || playerFcName?.toLowerCase().includes(data.homeTeam?.toLowerCase());
          const playerStats = isHome ? data.homeStats : data.awayStats;
          const oppStats = isHome ? data.awayStats : data.homeStats;
          const playerScore = isHome ? data.homeScore : data.awayScore;
          const oppScore = isHome ? data.awayScore : data.homeScore;
          const allScorers = data.scorers || [];
          const playerScorers = allScorers.filter((s:any) => (isHome && (s.team === 'Home' || s.team === data.homeTeam)) || (!isHome && (s.team === 'Away' || s.team === data.awayTeam)));
          const oppScorers = allScorers.filter((s:any) => (!isHome && (s.team === 'Home' || s.team === data.homeTeam)) || (isHome && (s.team === 'Away' || s.team === data.awayTeam)));

          // Logic
          if (playerScore > oppScore) {
             award('first_blood');
             if (oppScore === 0) award('clean_sheet_king');
             if (playerScore >= 3 && oppScore >= 3) award('thriller');
          } else if (playerScore === oppScore) {
             if (playerScore >= 3) award('thriller');
          }

          if (oppScore >= 5) award('goalkeeper_nightmare');

          playerScorers.forEach((s: any) => {
            if (s.goals >= 3) award('hat_trick_hero');
            if (s.goals >= 5) award('sniper');
            if (s.name && s.name.includes('(OG)')) award('uno_reversed');
            
            const times = String(s.time || '').split(',').map((t:string) => parseInt(t.trim().replace("'", ""))).filter(t => !isNaN(t));
            times.forEach((t:number) => {
              if (t >= 90) award('last_minute_hero');
              if (t === 67) award('lover_67');
              if (t === 69) award('lover_69');
            });
          });

          oppScorers.forEach((s: any) => {
            const times = String(s.time || '').split(',').map((t:string) => parseInt(t.trim().replace("'", ""))).filter(t => !isNaN(t));
            times.forEach((t:number) => {
              if (t >= 90) award('heartbreak_90');
            });
          });

          if (playerStats && playerStats.saves >= 10) award('spider_man');
          if (oppStats && oppStats.shotsOnTarget !== undefined && oppStats.shotsOnTarget === 0) award('fort_knox');

          if (newAchievements.length > 0) {
            const updates: any = {};
            newAchievements.forEach(id => {
               updates[`achievements.${id}`] = {
                 unlockedAt: FieldValue.serverTimestamp(),
                 seen: false
               };
            });
            await userRef.update(updates);
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
      
      const opponentName = (matchData.homeTeam?.toLowerCase().includes(fcName.toLowerCase()) || fcName.toLowerCase().includes(matchData.homeTeam?.toLowerCase()))
        ? matchData.awayTeam
        : matchData.homeTeam;
      
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
          timestamp: FieldValue.serverTimestamp(),
          imageUrl: base64,
          mimeType: mimeType || 'image/jpeg',
          matchId: matchData.matchId || null,
          analysisSummary: `Verified match between ${matchData.homeTeam} and ${matchData.awayTeam} (Reported by ${fcName || 'Unknown'})`
        };
        await db.collection('reports').add(reportData);
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
      const { key, model, source } = await getAiConfig();

      console.log(`[AI] Admin Command | Model: ${model} | Source: ${source}`);
      
      if (!key) throw new Error("GEMINI_API_KEY is not configured.");

      const ai = new GoogleGenAI({ apiKey: key });
      
      const teamsStr = teams && Array.isArray(teams) 
          ? teams.map((t: any) => `ID: "${t.id}", Names: ["${t.name}", "${t.fcName}"]`).join(' | ')
          : 'No teams available';

      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            role: "user",
            parts: [{
              text: `Today's date is ${new Date().toDateString()}.

              Registered Teams Reference (Find the Team ID by looking at the name or fcName):
              ${teamsStr}

              IF THE USER ASKS TO CREATE/SET MATCHES, output an UPDATE_MATCH command for EVERY single match they specified.
              - homeScore and awayScore must be 0 for scheduled matches.
              - status should be "scheduled"
              - matchId should be a unique random string (e.g. match-12345)
              
              User Command: ${command}`
            }]
          }
        ],
        config: {
          systemInstruction: "You are a Tournament Data Extractor AI. You must perfectly extract ALL matches provided by the user. If the user provides 16 matches, you MUST return exactly 16 objects. DO NOT stop early or summarize. Never hallucinate Team IDs, use the IDs from the reference list.",
          responseMimeType: "application/json",
          temperature: 0.1,
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                data: {
                  type: Type.OBJECT,
                  properties: {
                    matchId: { type: Type.STRING },
                    homeTeamId: { type: Type.STRING },
                    awayTeamId: { type: Type.STRING },
                    homeScore: { type: Type.INTEGER },
                    awayScore: { type: Type.INTEGER },
                    status: { type: Type.STRING },
                    date: { type: Type.STRING },
                    matchNumber: { type: Type.INTEGER },
                    matchday: { type: Type.INTEGER }
                  },
                  required: ["matchId", "homeTeamId", "awayTeamId", "homeScore", "awayScore", "status", "date", "matchNumber", "matchday"]
                }
              },
              required: ["type", "data"]
            }
          }
        }
      });

      const text = response.text || "[]";
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

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
