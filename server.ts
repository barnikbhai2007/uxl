import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import * as admin from "firebase-admin";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
admin.initializeApp({
  projectId: firebaseConfig.projectId
});

// Firestore initialization (Admin SDK)
// Note: Server-side writes are disabled due to IAM cross-project issues.
// We keep the initialization for potential future use or reading if permissions allow.
const db = new admin.firestore.Firestore({
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined
});

console.log(`Firestore initialized for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
