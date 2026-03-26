const OpenAI = require("openai");
// Import both the base identity and the new task-specific prompts
const { adjusterPrompt, taskSpecificPrompts } = require("../utils/prompt");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * @param {string} type - The format (email, file, or escalation)
 * @param {string} userInput - The raw data from the user
 * @param {string} task_type - The specific assistant (claim_note_drafting, damage_eval, etc.)
 */
const generateAIDraft = async (type, userInput, task_type) => {
    try {
        // 1. Get the instructions for the specific assistant chosen
        const taskInstruction = taskSpecificPrompts[task_type?.toLowerCase()] || "Draft a professional response based on the provided notes.";
        console.log(taskInstruction)

        // 2. Define the output format constraint
        // const formatStyle = `Please provide the final output as a professional ${type?.toUpperCase()}.`;

        // 3. Construct the layered System Message
        // Identity (Constant) + Task (Dynamic) + Format (Dynamic)
        const systemMessage = `
            ${adjusterPrompt}
            
            CURRENT ASSIGNMENT: ${taskInstruction}
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: `Context/Input: ${userInput}` }
            ],
            temperature: 0.5, // Lowered for more professional consistency
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI Service Error:", error);
        throw error;
    }
};

module.exports = { generateAIDraft };