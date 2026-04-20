import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = ai.getGenerativeModel({ model: "gemini-3-flash-preview" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
initializeApp({
  projectId: firebaseConfig.projectId
});

const db = getFirestore(
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined
);

console.log(`Firestore initialized for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);


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
      
      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64,
                mimeType: mimeType
              }
            },
            {
              text: `Analyze this FC Mobile match result screenshot for player "${fcName}". 
              Extract and return STRICT JSON: { "homeTeam": "...", "awayTeam": "...", "homeScore": 0, "awayScore": 0, "scorers": [{"name": "...", "goals": 1, "team": "..."}] }.
              If "${fcName}" is not listed as a participant, return { "error": "Player not found" }.`
            }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const text = result.response.text();
      const matchData = JSON.parse(text);
      
      if (matchData.error) {
          throw new Error(matchData.error);
      }
      
      if (matchData.homeTeam === undefined || matchData.awayTeam === undefined) {
          throw new Error("Could not parse match data correctly.");
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
      
      const teamsStr = teams && Array.isArray(teams) 
          ? teams.map((t: any) => `ID: "${t.id}", Names: ["${t.name}", "${t.fcName}"]`).join(' | ')
          : 'No teams available';

      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{
            text: `You are a Tournament Manager AI. Return ONLY a valid JSON array.
            Today's date is ${new Date().toDateString()}.

            Registered Teams Reference:
            ${teamsStr}

            Each item MUST follow this EXACT structure:
            { "type": "UPDATE_MATCH", "data": { "matchId": "...", "homeTeamId": "...", "awayTeamId": "...", "homeScore": 0, "awayScore": 0, "status": "scheduled", "date": "...", "matchNumber": 1, "matchday": 1 } }
            
            "matchId" must be spelled exactly as "matchId" not "matchld".
            CRITICAL: For homeTeamId and awayTeamId, you MUST use the EXACT 'ID' string from the "Registered Teams Reference" list above by semantically matching the team names the user asked for.
            For adding new matches use type "UPDATE_MATCH" with a new unique matchId.
            NEVER use "command" as a key. ALWAYS use "type" and "data".
            
            Command: ${command}`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const text = result.response.text();
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
