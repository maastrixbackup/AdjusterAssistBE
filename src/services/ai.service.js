const { OpenAI } = require("openai");

// Configure to use Groq's endpoint
const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1", 
});

const generateDraft = async (request, source) => {
    const systemPrompt = `
        You are AdjusterAssist, a mobile drafting tool for US property insurance claim handlers. 
        RULES:
        1. Only generate claim-related communications based on user-provided content.
        2. DO NOT invent facts. If info is missing, say "Based on available information...".
        3. No coverage determinations or policy interpretation.
        4. Maintain a professional, neutral tone.
    `;

    try {
        const response = await openai.chat.completions.create({
            // Use Llama 3 - it's free and very smart
            model: "llama-3.3-70b-versatile", 
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Request: ${request}\nSource Material: ${source}` }
            ],
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error("Groq AI Error:", error.message);
        throw error;
    }
};

module.exports = { generateDraft };