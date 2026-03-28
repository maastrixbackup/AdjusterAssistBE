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
    console.log(type);
    console.log(userInput);
    console.log(task_type);
    try {
        // 1. Logic: What is the assistant doing?
        const taskInstruction = taskSpecificPrompts[task_type?.toLowerCase()] || 
                                "Draft a professional response based on the provided notes.";

        // 2. Format: How should it be delivered?
        // We use the 'type' variable here to set the structure.
        const formatStyle = `Deliver the final response strictly as a professional ${type?.toUpperCase()}. 
        - If EMAIL: Include a Subject line and professional greeting.
        - If FILE: Format as an internal chronological log entry.
        - If ESCALATION: Use an urgent, formal tone for supervisor review.`;

        // 3. Construct the layered System Message
        const systemMessage = `
            ${adjusterPrompt}
            
            CURRENT ASSIGNMENT (THE LOGIC): ${taskInstruction}
            
            OUTPUT REQUIREMENT (THE FORMAT): ${formatStyle}
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-5.2",
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: `Context/Input: ${userInput}` }
            ],
            temperature: 0.5, 
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI Service Error:", error);
        throw error;
    }
};

module.exports = { generateAIDraft };