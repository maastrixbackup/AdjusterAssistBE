import OpenAI from "openai";
import { adjusterPrompt, getFormatInstruction } from "../utils/prompt.js";
import { getAppliedGuardrails } from "../utils/guardrails.js";

// Initialize OpenAI once
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Heavy generation for the final professional draft
 */
export const generateAIDraft = async (type, userInput, image) => {
    console.log("Generating AI Draft with input:", { type, userInput, hasImage: !!image });

    try {
        const formatStyle = getFormatInstruction(type);
        const guardrailInjection = getAppliedGuardrails(userInput);

        const userMessageContent = [
            {
                type: "text",
                text: `Here is the context and user notes for the assignment: ${userInput}`
            }
        ];

        // FIX: Check if image exists BEFORE calling .replace()
        if (image) {
            // Clean the base64 string only if it's not null
            const cleanedImage = image.replace(/^data:image\/\w+;base64,/, "");

            userMessageContent.push({
                type: "image_url",
                image_url: {
                    url: `data:image/jpeg;base64,${cleanedImage}`,
                    detail: "auto"
                }
            });
        }

        const systemMessage = `
            ${adjusterPrompt}
            ${guardrailInjection}
            VISION INSTRUCTION: If an image is provided, analyze it. If not, ignore this.
            OUTPUT REQUIREMENT (THE FORMAT): ${formatStyle}
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: userMessageContent }
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