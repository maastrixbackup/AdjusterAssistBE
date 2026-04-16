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
export const generateAIDraft = async (type, userInput, files = []) => {
    console.log("Generating AI Draft with input:", { 
        type, 
        fileCount: files.length 
    });

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

        // 2. Process Files
        for (const file of files) {
            if (file.mimetype.startsWith('image/')) {
                console.log("IMAGE ATTACHED")
                const imageBase64 = fs.readFileSync(file.path, { encoding: 'base64' });
                userMessageContent.push({
                    type: "image_url",
                    image_url: {
                        url: `data:${file.mimetype};base64,${imageBase64}`,
                        detail: "auto"
                    }
                });
            } 

            if (file.mimetype === 'application/pdf') {
                console.log("PDF ATTACHED")
                userMessageContent[0].text += `\n[Note: A PDF named ${file.originalname} was attached for context. Please assume standard insurance documentation details apply.]`;
            }
        }

        const systemMessage = `
            ${adjusterPrompt}
            ${guardrailInjection}
            VISION INSTRUCTION: Analyze all provided images (damage photos, receipts, etc.). 
            If no images are provided, rely strictly on text context.
            OUTPUT REQUIREMENT (THE FORMAT): ${formatStyle}
        `;

        // 3. Call the Model (gpt-4o is the best multimodal choice)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", 
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: userMessageContent }
            ],
            temperature: 0.4, // Slightly lower for more consistent insurance drafting
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