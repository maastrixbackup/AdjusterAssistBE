import OpenAI from "openai";
import { adjusterPrompt, taskSpecificPrompts, getFormatInstruction } from "../utils/prompt.js"; // Added .js extension
import { getAppliedGuardrails } from "../utils/guardrails.js"; // Added .js extension

// Initialize OpenAI once
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Heavy generation for the final professional draft
 */
export const generateAIDraft = async (type, userInput, task_type) => {
    try {
        // 1. Identify the Task Logic
        const taskInstruction = taskSpecificPrompts[task_type?.toLowerCase()] || 
                                "Draft a professional response based on the provided notes.";

        // 2. Identify the Formatting Requirements
        const formatStyle = getFormatInstruction(type);

        // 3. Apply Trigger-Based Guardrails
        const guardrailInjection = getAppliedGuardrails(userInput);

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

/**
 * Fast, low-latency classification for the "Decision Engine"
 */
export const generateFastClassification = async (systemPrompt, userInput) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userInput }
            ],
            temperature: 0,
            max_tokens: 20
        });

        // Use the SDK path correctly (no .data) and clean the output
        const content = response.choices[0].message.content.trim();
        return content.replace(/['".]/g, ""); 
        
    } catch (error) {
        console.error("Fast Classification AI Error:", error);
        // Fallback rule as per Enterprise Spec
        return "file_note"; 
    }
};