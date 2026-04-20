import { GoogleGenerativeAI } from "@google/generative-ai";
import { VercelRequest, VercelResponse } from '@vercel/node';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = ai.getGenerativeModel({ model: "gemini-3-flash-preview" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { command } = req.body;
    
    const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{
            text: `You are a Tournament Manager AI. Return ONLY a valid JSON array.
            Today's date is ${new Date().toDateString()}.
            Each item MUST follow this EXACT structure:
            { "type": "UPDATE_MATCH", "data": { "matchId": "...", "homeTeamId": "...", "awayTeamId": "...", "homeScore": 0, "awayScore": 0, "status": "scheduled", "date": "...", "matchNumber": 1, "matchday": 1 } }
            
            "matchId" must be spelled exactly as "matchId" not "matchld".
            For homeTeamId and awayTeamId use the team name as-is, the frontend will match it.
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
    const commands = JSON.parse(text);

    res.json({ success: true, commands });
  } catch (error: any) {
    console.error("AI Admin Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}
