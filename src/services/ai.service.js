import OpenAI from "openai";
import { adjusterPrompt, guidancePrompt, getAudienceInstruction, getFormatInstruction, getMarkdownInstruction, refinementMap, BASE_REFINEMENT_RULES } from "../utils/prompt.js";
import { getAppliedGuardrails } from "../utils/guardrails.js";
import fs from 'fs';
import { getSignaturePrompt } from "../utils/signature.js";
import { signatureMiddleware } from "../middlewares/cleanSignature.js";

// Initialize OpenAI once
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const generateAIDraft = async (type, userInput, payload, conversationHistory = "", audienceType, userProfile) => {
    try {
        const formatStyle = getFormatInstruction(type);
        const guardrailInjection = getAppliedGuardrails(userInput);
        const audienceInstruction = getAudienceInstruction(audienceType);
        const signaturePrompt = getSignaturePrompt(type, userProfile);
        console.log("[AI] Signature Prompt: ", signaturePrompt);
        const markdownInstruction =
            type === "claim_guidance"
                ? "Use clean paragraphs. Avoid heavy markdown, bullets and bold only if necessary."
                : getMarkdownInstruction(payload?.drafting_controls?.markdown_level);

        console.log("[AI] MARKDOWN LEVEL:", payload?.drafting_controls?.markdown_level);
        // console.log("[MD]: ", markdownInstruction)

        const userMessageContent = [
            {
                type: "text",
                text: `Context and user notes: ${userInput}`
            }
        ];

        const basePrompt = type === "claim_guidance"
            ? guidancePrompt
            : adjusterPrompt;

        const systemMessage = `
        ### ROLE & CORE LOGIC
        ${basePrompt}

        ### SAFETY & COMPLIANCE
        ${guardrailInjection}

        ### CONTEXTUAL SCOPE
        Target Audience: ${audienceType}
        Audience Specific Instructions: ${audienceInstruction}

        ### FORMATTING RULES (CRITICAL)
        ${markdownInstruction}
        ${signaturePrompt}

        ### FINAL OUTPUT CONSTRAINTS (STRICT)
        ${formatStyle}
        `;

        if (conversationHistory) {
            console.log("[RAG PIPELINE] Reading Context from Previous Message Threads")
        }
        // 3. Call the Model (gpt-4o is the best multimodal choice)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemMessage },

                {
                    role: "user",
                    content: `### STRUCTURED CLAIM PAYLOAD(CRITICAL)\n${JSON.stringify(payload, null, 2)}`
                },

                {
                    role: "user",
                    content: `### CLAIM HISTORY\n${conversationHistory}`
                },

                {
                    role: "user",
                    content: `### USER REQUEST\n${userInput}`
                }
            ],
            temperature: 0.4,
        });

        const rawContent = completion.choices[0].message.content;

        const isSignatureEnabled = payload?.user_profile?.is_signature_enabled || false;
        const finalContent = signatureMiddleware(rawContent, isSignatureEnabled);

        // Console Log Verification
        if (!isSignatureEnabled && rawContent !== finalContent) {
            console.log("⚠️  [SIGNATURE CONTROL]: AI hallucinated a signature. Middleware successfully stripped it.");
        } else if (!isSignatureEnabled && rawContent === finalContent) {
            console.log("✅ [SIGNATURE CONTROL]: AI followed instructions perfectly. No cleaning required.");
        } else {
            console.log("ℹ️  [SIGNATURE CONTROL]: Signature enabled for this draft.");
        }

        console.log("[AI] Response Processed");
        return finalContent;
    } catch (error) {
        console.error("[AI] OpenAI Service Error:", error);
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
        console.error("[AI] Fast Classification AI Error:", error);
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

/**
 * 🔥 REFINEMENT SERVICE (TRANSFORMATION MODE)
 * - Does NOT generate new content
 * - ONLY refines existing response
 * - Preserves structure, facts, and format
 */
export const refineAIDraft = async ({
    refinementType,
    originalResponse,
    audienceType = "internal"
}) => {
    try {
        if (!originalResponse || originalResponse.length < 10) {
            throw new Error("Invalid original response for refinement");
        }

        const refinementInstruction = refinementMap[refinementType];

        if (refinementInstruction) {
            console.log("[REFINEMENT] Instructions for: ", refinementType)
        } else {
            console.log("[REFINEMENT]: Invalid type: ", refinementType)
        }

        const audienceInstruction = getAudienceInstruction(audienceType);

        const systemMessage = `
### ROLE
You are an expert insurance claim response editor.

### REFINEMENT MODE (CRITICAL)
${refinementInstruction}

### AUDIENCE CONTEXT
Target Audience: ${audienceType}
Audience Instruction: ${audienceInstruction}

### FINAL RULE
Return ONLY the refined response.
DO NOT add explanations.
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemMessage },

                {
                    role: "user",
                    content: `
### ORIGINAL RESPONSE (TO BE REFINED)
${originalResponse}
`
                }
            ],
            temperature: 0.2, // 🔥 lower = safer, less hallucination
        });

        console.log(`[REFINEMENT]: ${refinementType} applied`);

        return completion.choices[0].message.content;

    } catch (error) {
        console.error("Refinement Service Error:", error);
        throw new Error("Failed to refine AI response");
    }
};

