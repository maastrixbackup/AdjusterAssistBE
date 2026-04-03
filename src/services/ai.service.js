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
        console.log("TASK:",taskInstruction)

        // 2. Identify the Formatting Requirements (Separated)
        const formatStyle = getFormatInstruction(type);
        console.log("FORMAT APPLIED:", formatStyle)

        // 3. Apply Trigger-Based Guardrails (New Feature)
        const guardrailInjection = getAppliedGuardrails(userInput);
        console.log(`GUARDRAILS INJECTION: ${guardrailInjection}`)
        
        // 4. Construct the Layered System Message
        const systemMessage = `
            ${adjusterPrompt}
            CURRENT ASSIGNMENT (THE LOGIC): ${taskInstruction}
            ${guardrailInjection}
            OUTPUT REQUIREMENT (THE FORMAT): ${formatStyle}
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo", 
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