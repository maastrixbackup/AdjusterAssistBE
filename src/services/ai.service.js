const OpenAI = require("openai");
const { adjusterPrompt, taskSpecificPrompts, getFormatInstruction } = require("../utils/prompt");
const { getAppliedGuardrails } = require("../utils/guardrails"); // Import Guardrails

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


const generateAIDraft = async (type, userInput, task_type) => {
    try {
        // 1. Identify the Task Logic
        const taskInstruction = taskSpecificPrompts[task_type?.toLowerCase()] || 
                                "Draft a professional response based on the provided notes.";

        // 2. Identify the Formatting Requirements (Separated)
        const formatStyle = getFormatInstruction(type);

        // 3. Apply Trigger-Based Guardrails (New Feature)
        const guardrailInjection = getAppliedGuardrails(userInput);

        // 4. Construct the Layered System Message
        const systemMessage = `
            ${adjusterPrompt}
            
            CURRENT ASSIGNMENT (THE LOGIC): ${taskInstruction}
            
            OUTPUT REQUIREMENT (THE FORMAT): ${formatStyle}

            ${guardrailInjection}
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo", // Note: Corrected from 'gpt-5.2' to a valid model name
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