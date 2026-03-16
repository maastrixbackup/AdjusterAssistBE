const OpenAI = require("openai");
const {adjusterPrompt} =  require("../utils/prompt")

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


const generateAIDraft = async (type, userInput) => {
    try {
        const systemMessage = adjusterPrompt[type?.toLowerCase()] || "You are a helpful insurance adjustment assistant.";

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: userInput }
            ],
            temperature: 0.7,
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI Service Error:", error);
        throw error; // Let the controller handle the status codes
    }
};

module.exports = { generateAIDraft };