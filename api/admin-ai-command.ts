import { GoogleGenerativeAI } from "@google/generative-ai";
import { VercelRequest, VercelResponse } from '@vercel/node';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

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
            text: `You are a Tournament Manager AI. 
            Return ONLY a raw JSON array.
            Available Commands:
            - UPDATE_MATCH: { matchId, homeScore, awayScore, status, homeScorers, awayScorers, homeStats, awayStats, manOfTheMatch }
            - RESET: { type: 'matches' | 'bracket' | 'all' }
            - UPDATE_CONTENT: { elementId, text, isImage: boolean }
            - APPROVE_REGISTRATION: { registrationId }
            - REJECT_REGISTRATION: { registrationId }
            
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
