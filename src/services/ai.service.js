import OpenAI from "openai";
import { adjusterPrompt, getAudienceInstruction, getFormatInstruction } from "../utils/prompt.js";
import { getAppliedGuardrails } from "../utils/guardrails.js";
import fs from 'fs';

// Initialize OpenAI once
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Heavy generation for the final professional draft
 */
export const generateAIDraft = async (type, userInput, conversationHistory = "", audienceType) => {
    try {
        const formatStyle = getFormatInstruction(type);
        const guardrailInjection = getAppliedGuardrails(userInput);
        const audienceInstruction = getAudienceInstruction(audienceType);

        // 1. Initialize message content with the text prompt
        const userMessageContent = [
            {
                type: "text",
                text: `Context and user notes: ${userInput}`
            }
        ];
        
        const systemMessage = `
        ### ROLE & CORE LOGIC
        ${adjusterPrompt}

        ### SAFETY & COMPLIANCE
        ${guardrailInjection}

        ### CONTEXTUAL SCOPE
        Target Audience: ${audienceType}
        Audience Specific Instructions: ${audienceInstruction}

        ### FINAL OUTPUT CONSTRAINTS (STRICT)
        ${formatStyle}
        `;

        if (conversationHistory) {
            console.log("Reading Context from Previous Message Threads...")
        }
        // 3. Call the Model (gpt-4o is the best multimodal choice)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemMessage },
                {
                    role: "user",
                    content: `Here is the historical context for this claim:\n${conversationHistory}`
                },
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

export const generateJSON = async (systemPrompt, userContent) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Use a faster/cheaper model for extraction
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent }
            ],
            response_format: { type: "json_object" }, // Forces JSON mode
            temperature: 0, // Keep it deterministic
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error("Extractor Service Error:", error);
        throw new Error("Failed to parse AI extraction");
    }
}