import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { GoogleGenerativeAI } from "@google/generative-ai";

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
initializeApp({
  projectId: firebaseConfig.projectId
});

// Firestore initialization (Admin SDK)
// Note: Server-side writes are disabled due to IAM cross-project issues.
// We keep the initialization for potential future use or reading if permissions allow.
const db = getFirestore(
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined
);

console.log(`Firestore initialized for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // AI Endpoint for match analysis
  app.post("/api/analyze-match", async (req, res) => {
    try {
      const { base64, mimeType, fcName } = req.body;
      
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64,
            mimeType: mimeType
          }
        },
        {
          text: `Analyze this FC Mobile match result screenshot for player "${fcName}". 
          Extract and return JSON: { homeTeam, awayTeam, homeScore, awayScore }.
          If "${fcName}" is not listed as a participant, return error.`
        }
      ]);

      const text = result.response.text();
      const matchData = JSON.parse(text.replace(/```json\n?|\n?```/g, ""));
      
      if (!matchData.homeTeam || !matchData.awayTeam) {
          throw new Error("Could not parse match data");
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
      const { command } = req.body;
      
      const result = await model.generateContent([
        {
          text: `You are a Tournament Manager AI. 
          Available Commands:
          - UPDATE_MATCH: { matchId, homeScore, awayScore, status, homeScorers, awayScorers, homeStats, awayStats, manOfTheMatch }
          - RESET: { type: 'matches' | 'bracket' | 'all' }
          - UPDATE_CONTENT: { elementId, text, isImage: boolean }
          - APPROVE_REGISTRATION: { registrationId }
          - REJECT_REGISTRATION: { registrationId }
          
          Respond only with a JSON array of commands. Example: [{"type": "UPDATE_MATCH", "data": {...}}]
          Command: ${command}`
        }
      ]);

      const text = result.response.text();
      const commands = JSON.parse(text.replace(/```json\n?|\n?```/g, ""));
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
