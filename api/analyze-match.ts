import { GoogleGenerativeAI } from "@google/generative-ai";
import { VercelRequest, VercelResponse } from '@vercel/node';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = ai.getGenerativeModel({ model: "gemini-3-flash-preview" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

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
            Extract and return STRICT JSON: { "homeTeam": "...", "awayTeam": "...", "homeScore": 0, "awayScore": 0, "scorers": [{"name": "...", "goals": 1, "team": "Home", "time": "45'"}], "homeStats": { "possession": 50, "shots": 0, "shotsOnTarget": 0, "passAccuracy": 0, "fouls": 0, "offsides": 0, "saves": 0 }, "awayStats": { "possession": 50, "shots": 0, "shotsOnTarget": 0, "passAccuracy": 0, "fouls": 0, "offsides": 0, "saves": 0 }, "manOfTheMatch": "..." }.
            CRITICAL FOR SCORERS: Look for soccer ball icons ⚽ followed by numbers like 45', 90+2'. You MUST extract this exact minute into the "time" field for each scorer. If a player scores multiple goals, list them or combine times.
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
}
