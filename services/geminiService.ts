import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeDemographics = async (companies: string[], passTypes: string[]): Promise<string> => {
  try {
    const ai = getAiClient();
    
    // Sample a subset if too large to avoid token limits on the huge list
    const companySample = companies.slice(0, 100).join(", ");
    const passSample = passTypes.slice(0, 100).join(", ");

    const prompt = `
      I have a list of conference attendees.
      Companies: ${companySample} ... (and more).
      Pass Types: ${passSample} ... (and more).

      Please provide a concise, professional executive summary (max 3 bullet points) describing the demographic profile of this conference. 
      Focus on the types of industries represented (e.g., Banking, Tech, Consulting) and the seniority implied by the pass types.
      Do not format as markdown, just plain text.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Analysis complete.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Unable to generate AI insights at this time. Please check API Key configuration.";
  }
};