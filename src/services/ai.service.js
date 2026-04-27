import OpenAI from "openai";
import { adjusterPrompt, getFormatInstruction } from "../utils/prompt.js";
import { getAppliedGuardrails } from "../utils/guardrails.js";
import fs from 'fs';

// Initialize OpenAI once
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Heavy generation for the final professional draft
 */
export const generateAIDraft = async (type, userInput, files = [], conversationHistory = [], audienceType) => {
    try {
        const formatStyle = getFormatInstruction(type);
        const guardrailInjection = getAppliedGuardrails(userInput);

        // 1. Initialize message content with the text prompt
        const userMessageContent = [
            {
                type: "text",
                text: `Context and user notes: ${userInput}`
            }
        ];


        const systemMessage = `
            ${adjusterPrompt}
            ${guardrailInjection}
            VISION INSTRUCTION: Analyze all provided images (damage photos, receipts, etc.).
            If no images are provided, rely strictly on text context.
            OUTPUT REQUIREMENT (THE FORMAT): ${formatStyle}
            TARGET AUDIENCE : ${audienceType}
        `;

        if (conversationHistory) {
            console.log("Reading Context from Previous Message Threads...")
        }
        // 3. Call the Model (gpt-4o is the best multimodal choice)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemMessage },
                ...conversationHistory,
                { role: "user", content: userMessageContent }
            ],
            temperature: 0.4, // Slightly lower for more consistent insurance drafting
        });
        console.log("Response Generated")
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