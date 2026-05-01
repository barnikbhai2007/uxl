import { GoogleGenerativeAI } from "@google/generative-ai";
import { VercelRequest, VercelResponse } from '@vercel/node';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = ai.getGenerativeModel({ model: "gemini-flash-latest" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { command, teams } = req.body;
    
    // Convert teams array to string representation for the prompt context
    const teamsStr = teams && Array.isArray(teams) 
        ? teams.map((t: any) => `ID: "${t.id}", Names: ["${t.name}", "${t.fcName}"]`).join(' | ')
        : 'No teams available';

    const result = await model.generateContent({
        contents: [{
          role: "user",
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
            2. DO NOT HALUCINATE TEAM IDs. You MUST use the 'ID' corresponding to the "Names" given in the reference. If SOUVIK isn't perfectly matching, use the closest logical match from the Reference List. If you cannot find a team, use the name the user provided as the ID.
            3. DO NOT truncate.
            
            User Command: ${command}`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

    const text = result.response.text();
    const commands = JSON.parse(text);

    res.json({ success: true, commands });
  } catch (error: any) {
    console.error("AI Admin Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}
