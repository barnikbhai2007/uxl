import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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
    const model = configData?.geminiModel || "gemini-3.1-pro-preview";
    const source = configData?.geminiModel ? "Firestore" : "Environment Default";
    return { key, model, source };
  } catch (error) {
    console.error("Error fetching AI config from Firestore:", error);
    return { key: process.env.GEMINI_API_KEY, model: "gemini-3.1-pro-preview", source: "Fallback" };
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
      const { base64, mimeType, fcName } = req.body;
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
                
                INSTRUCTIONS:
                1. Identify the Home Team and Away Team names.
                2. Identify the Final Score (Home vs Away).
                3. Identify Goal Scorers (name, goals, and which team they played for).
                4. Extract Match Stats (Possession, Shots, Shots on Target, Pass Accuracy, Fouls, Offsides) for both teams.
                5. Identify the Man of the Match.
                
                CRITICAL: One of the teams MUST reasonably match "${fcName}" (could be a partial match or slightly different spelling due to OCR).
                If neither team matches "${fcName}", return { "error": "Reporting player name was not found as a participant in this screenshot." }.
                
                Return STRICT JSON: 
                { 
                  "homeTeam": "...", 
                  "awayTeam": "...", 
                  "homeScore": 0, 
                  "awayScore": 0, 
                  "scorers": [{"name": "...", "goals": 1, "team": "..."}], 
                  "homeStats": { "possession": 50, "shots": 0, "shotsOnTarget": 0, "passAccuracy": 0, "fouls": 0, "offsides": 0 }, 
                  "awayStats": { "possession": 50, "shots": 0, "shotsOnTarget": 0, "passAccuracy": 0, "fouls": 0, "offsides": 0 }, 
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
      const matchData = JSON.parse(text);
      
      if (matchData.error) {
          throw new Error(matchData.error);
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
              text: `You are a Tournament Manager AI. Return ONLY a valid JSON array.
              Today's date is ${new Date().toDateString()}.

              Registered Teams Reference:
              ${teamsStr}

              Each item MUST follow this EXACT structure:
              { "type": "UPDATE_MATCH", "data": { "matchId": "...", "homeTeamId": "...", "awayTeamId": "...", "homeScore": 0, "awayScore": 0, "status": "scheduled", "date": "...", "matchNumber": 1, "matchday": 1 } }
              
              "matchId" must be spelled exactly as "matchId".
              CRITICAL: For homeTeamId and awayTeamId, you MUST use the EXACT 'ID' string from the "Registered Teams Reference" list above by semantically matching the team names the user asked for.
              For adding new matches use type "UPDATE_MATCH" with a new unique matchId.
              
              Command: ${command}`
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
