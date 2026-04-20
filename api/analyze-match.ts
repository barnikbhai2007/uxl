import { GoogleGenerativeAI } from "@google/generative-ai";
import { VercelRequest, VercelResponse } from '@vercel/node';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

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
}
