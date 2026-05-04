import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { GoogleGenAI } from "@google/genai";
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
                1. Identify the TWO TEAM NAMES (Left side and Right side). BE CAREFUL NOT TO DETECT THE LEAGUE NAME AS THE TEAM NAME. Look explicitly for the actual player or account names positioned at the very top left and very top right.
                2. Identify the Final Score which is displayed in the middle (Left Score - Right Score).
                3. Identify Goal Scorers (name, goals, time of goal, team) by matching exactly the team1 or team2 name. You MUST include "time" formatted like "45', 60'" and "team" must match team1 or team2 exactly.
                4. Extract Match Stats (Possession, Shots, Shots on Target, Pass Accuracy, Fouls, Offsides, SAVES). Ensure you assign the correct stats to the correct team.
                5. MAN OF THE MATCH: Find the player labeled "Man of the Match". If not labeled, select the player with the best stats. You MUST output this.
                
                CRITICAL: One of the teams MUST reasonably match "${fcName}". If the player name "${fcName}" is mentioned anywhere in the top area, assign them as one of the teams.
                If neither team matches "${fcName}" and it is nowhere to be found, return { "error": "Reporting player name was not found as a participant in this screenshot." }.
                
                Return STRICT JSON: 
                { 
                  "team1": "...", 
                  "team2": "...", 
                  "team1Score": 0, 
                  "team2Score": 0, 
                  "scorers": [{"name": "Player Name", "goals": 1, "team": "<MUST be the exact string of team1 or team2>", "time": "45'"}], 
                  "team1Stats": { "possession": 50, "shots": 0, "shotsOnTarget": 0, "passAccuracy": 0, "fouls": 0, "offsides": 0, "saves": 0 }, 
                  "team2Stats": { "possession": 50, "shots": 0, "shotsOnTarget": 0, "passAccuracy": 0, "fouls": 0, "offsides": 0, "saves": 0 }, 
                  "manOfTheMatch": "Player Name" 
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

          const isTeam1 = data.team1?.toLowerCase().includes(playerFcName.toLowerCase()) || playerFcName?.toLowerCase().includes(data.team1?.toLowerCase());
          const playerStats = isTeam1 ? data.team1Stats : data.team2Stats;
          const oppStats = isTeam1 ? data.team2Stats : data.team1Stats;
          const playerScore = isTeam1 ? data.team1Score : data.team2Score;
          const oppScore = isTeam1 ? data.team2Score : data.team1Score;
          const allScorers = data.scorers || [];
          const playerScorers = allScorers.filter((s:any) => (isTeam1 && (s.team === 'Team 1' || s.team === data.team1)) || (!isTeam1 && (s.team === 'Team 2' || s.team === data.team2)));
          const oppScorers = allScorers.filter((s:any) => (!isTeam1 && (s.team === 'Team 1' || s.team === data.team1)) || (isTeam1 && (s.team === 'Team 2' || s.team === data.team2)));

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
          timestamp: FieldValue.serverTimestamp(),
          imageUrl: base64,
          mimeType: mimeType || 'image/jpeg',
          matchId: matchData.matchId || null,
          analysisSummary: `Verified match between ${matchData.team1} and ${matchData.team2} (Reported by ${fcName || 'Unknown'})`
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
            parts: [{
              text: `You are a Tournament Data Extractor AI. You must return ONLY a JSON array of commands.
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
            }]
          }
        ],
        config: {
          responseMimeType: "application/json"
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
