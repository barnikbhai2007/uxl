import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ygrmdlbyfrbqhzvvfmii.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_taKejserySOg3UGPlk0h-w_7tWsZDiN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getAiConfig() {
  try {
    const { data: configSnap } = await supabase.from('documents').select('data').eq('collection', 'config').eq('id', 'system').single();
    const configData = configSnap?.data || null;
    const key = configData?.geminiApiKey || process.env.GEMINI_API_KEY;
    const model = configData?.geminiModel || "gemini-flash-latest";
    const source = configData?.geminiModel ? "Supabase" : "Environment Default";
    return { key, model, source };
  } catch (error) {
    console.error("Error fetching AI config from Supabase:", error);
    return { key: process.env.GEMINI_API_KEY, model: "gemini-flash-latest", source: "Fallback" };
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // IMPORTANT: Configure CORS to allow your Vercel frontend URL
  app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
  
  app.use(express.json({ limit: '10mb' }));

  // AI Endpoint for Testing Connection
  app.get("/api/test-ai", async (req, res) => {
    try {
      const { key, model, source } = await getAiConfig();
      if (!key) throw new Error("GEMINI_API_KEY is not configured.");

      const ai = new GoogleGenAI({ apiKey: key });
      
      const result = await ai.models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [{ text: "Respond with only the word 'OK' if you can read this." }] }]
      });
      const text = result.text;
      
      res.json({ success: true, message: `Connected to ${model} successfully! AI response: ${text}`, source });
    } catch (error: any) {
      console.error("AI Test Error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

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
                1. Identify the TWO TEAM NAMES from the top header or team logos (Left team = "team1", Right team = "team2").
                2. Identify the Final Score in the middle (Left Score - Right Score). team1Score is Left, team2Score is Right.
                3. Goal Scorers List: Under the main scores or in the match facts, there are often player names listed with soccer ball icons and minutes (e.g., 45', 90').
                   - If a player name is on the LEFT half of the screen, they scored for "team1".
                   - If a player name is on the RIGHT half of the screen, they scored for "team2".
                   - For each scorer, provide "name", "goals" (count the number of ball icons or goals scored by this player), "time" (the minutes like "45', 50'"), and the "team" ("team1" or "team2").
                4. Match Stats: Extract Possession, Shots, Shots on Target, Pass Accuracy, Fouls, Offsides, Saves.
                   - The left-side numeric values belong to "team1Stats".
                   - The right-side numeric values belong to "team2Stats".
                5. MAN OF THE MATCH: Look for the player highlighted with a star, MVP badge, or labelled as Man of the Match. Assign their name to "manOfTheMatch". If not explicitly shown, just leave it null or pick the best performing player based on stats/goals.
                
                CRITICAL RULES:
                - Ensure "team1Score" matches the total number of goals in the "team1" scorers list if possible.
                - One team must match or contain "${fcName}".
                
                Return JSON in this exact structure:
                { 
                  "team1": "string", "team2": "string", 
                  "team1Score": number, "team2Score": number, 
                  "scorers": [{ "name": "string", "goals": number, "team": "team1"|"team2", "time": "string" }],
                  "team1Stats": { "possession": number, "shots": number, "shotsOnTarget": number, "passAccuracy": number, "fouls": number, "offsides": number, "saves": number },
                  "team2Stats": { "possession": number, "shots": number, "shotsOnTarget": number, "passAccuracy": number, "fouls": number, "offsides": number, "saves": number },
                  "manOfTheMatch": "string"
                }`
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text() || "{}";
      const resultParsed = JSON.parse(text);
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
