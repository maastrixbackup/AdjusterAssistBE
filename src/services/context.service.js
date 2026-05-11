const OpenAI = require('openai');
const {supabaseAdmin} = require('../config/supabase.js');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_EMBEDDING_CHARS = 3000;

const reWritePrompt = `You are an insurance claim search optimizer.

Convert the user command into a factual claim query using:
- loss details
- damaged areas
- cause of loss
- claim status

DO NOT include instructions like "convert", "draft", "create".

Return ONLY the factual query.`;

/**
 * 🔹 Utility: Safe trim for embeddings
 */
const trimForEmbedding = (text = "") => {
    return text.length > MAX_EMBEDDING_CHARS
        ? text.slice(0, MAX_EMBEDDING_CHARS)
        : text;
};

/**
 * 🔹 Utility: Clean + dedupe context
 */
const cleanContext = (texts = []) => {
    const seen = new Set();

    return texts
        .map(t => t?.trim())
        .filter(Boolean)
        .filter(t => {
            if (seen.has(t)) return false;
            seen.add(t);
            return true;
        })
        .join("\n---\n");
};

const ContextService = {

    /**
     * 🔹 QUERY REWRITE (IMPROVED)
     */
    rewriteQuery: async (userInput, history = []) => {
        try {
            const chatContext = history
                .slice(-5)
                .map(m => `User: ${m.user_input}\nAI: ${m.ai_response}`)
                .join("\n\n");

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: reWritePrompt
                    },
                    {
                        role: "user",
                        content: `Recent History:\n${chatContext}\n\nUser Command: ${userInput}`
                    }
                ],
                temperature: 0,
            });

            return response.choices[0].message.content?.trim() || userInput;
        } catch (err) {
            return userInput;
        }
    },

    /**
     * 🔥 MAIN RAG FUNCTION (ENHANCED)
     */
    getRelevantContext: async (fileId, userInput) => {
        try {
            // ✅ STEP 0: INTENT DETECTION (NEW)
            const isConversionIntent =
                /convert|make|draft|turn|rewrite|format|create/i.test(userInput);

            const isQuestionIntent =
                /\?|what|should|can|do i|next step|best step|guidance|advise/i.test(userInput.toLowerCase());

            // 👇 THIS WILL CONTROL HOW RAG BEHAVES
            let ragMode = "default";
            if (isConversionIntent) ragMode = "conversion";
            else if (isQuestionIntent) ragMode = "guidance";

            console.log("[ RAG MODE ]:", ragMode);

            /**
             * ==========================================
             * 🔹 STEP 1: FETCH RECENT CONTEXT (SMART)
             * ==========================================
             */
            const { data: recentMessages } = await supabaseAdmin
                .from('claim_messages')
                .select('user_input, ai_response')
                .eq('workspace_id', fileId)
                .order('created_at', { ascending: false })
                .limit(3);

            const contextSnippet = (recentMessages || [])
                .map(m => `${m.user_input} ${m.ai_response}`)
                .join(" ");

            /**
             * ==========================================
             * 🔹 STEP 2: HYBRID QUERY (CLEANED)
             * ==========================================
             */
            let hybridQuery;

            if (ragMode === "conversion") {
                // 🔥 Conversion = focus on LAST AI OUTPUT (VERY IMPORTANT)
                hybridQuery = contextSnippet; // ignore userInput noise
            }
            else if (ragMode === "guidance") {
                // 🔥 Guidance = focus on facts + user question
                hybridQuery = `${userInput} ${contextSnippet}`;
            }
            else {
                // Default behavior
                hybridQuery = `${userInput} ${contextSnippet}`;
            }
            /**
             * ==========================================
             * 🔹 STEP 3: PRIMARY VECTOR SEARCH
             * ==========================================
             */
            const directEmbeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: hybridQuery,
            });

            let { data: matches } = await supabaseAdmin.rpc('match_claim_context', {
                query_embedding: directEmbeddingResponse.data[0].embedding,
                match_threshold: 0.5,
                match_count: 5,
                target_claim_id: fileId,
            });

            /**
             * ==========================================
             * 🔹 STEP 4: FILTER LOW QUALITY MATCHES
             * ==========================================
             */
            if (matches?.length) {
                matches = matches.filter(m => m.content && m.content.length > 30);
            }

            /**
             * ==========================================
             * 🔹 STEP 5: WEAK QUERY DETECTION (IMPROVED)
             * ==========================================
             */
            const isWeakQuery =
                userInput.length < 40 ||
                ragMode === "conversion";

            /**
             * ==========================================
             * 🔹 STEP 6: FALLBACK (UNCHANGED CORE)
             * ==========================================
             */
            if (isWeakQuery || !matches || matches.length === 0) {
                console.log("[RAG] Weak query or no matches. Activating fallback...");

                const { data: historyData, error: historyError } = await supabaseAdmin
                    .from('claim_messages')
                    .select('user_input, ai_response')
                    .eq('workspace_id', fileId)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (!historyError && historyData?.length > 0) {

                    const lastAIResponse = historyData[0].ai_response;
                    if (ragMode === "guidance") {
                        const contextSnippet = historyData
                            .map(m => `${m.user_input} ${m.ai_response}`)
                            .join("\n---\n");

                        return `
                            CLAIM_CONTEXT:
                            ${contextSnippet}

                            USER_QUESTION:
                            ${userInput}

                            INSTRUCTION:
                            Answer the question like an experienced adjuster.

                            Structure:
                            1. Direct answer
                            2. Reasoning
                            3. Claim-safe limitation (no coverage commitment)
                            4. Recommended next step

                            Do NOT convert format.
                            `.trim();
                    }

                    /**
                     * 🔹 STEP 6A: REWRITE QUERY
                     */
                    const history = [...historyData].reverse();

                    const optimizedQuery = await ContextService.rewriteQuery(
                        userInput,
                        history
                    );

                    console.log("[RAG] Optimized Query:", optimizedQuery);

                    /**
                     * 🔹 STEP 6B: RETRY VECTOR SEARCH
                     */
                    const retryEmbedding = await openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: trimForEmbedding(optimizedQuery),
                    });

                    let { data: retryMatches } = await supabaseAdmin.rpc('match_claim_context', {
                        query_embedding: retryEmbedding.data[0].embedding,
                        match_threshold: 0.35,
                        match_count: 5,
                        target_claim_id: fileId,
                    });

                    /**
                     * 🔹 STEP 6C: CLEAN CONTEXT
                     */
                    const vectorContext = cleanContext(
                        (retryMatches || []).map(m => m.content)
                    );

                    /**
                     * 🔹 FINAL RETURN (UNCHANGED STRUCTURE)
                     */
                    return `
SOURCE_TEXT_TO_CONVERT:
"""
${lastAIResponse}
"""

ADDITIONAL_CLAIM_FACTS:
${vectorContext}

INSTRUCTION: Use the SOURCE_TEXT_TO_CONVERT as the primary material for the requested format.`.trim();
                }
            }

            /**
             * ==========================================
             * 🔹 STEP 7: RETURN CLEANED MATCHES
             * ==========================================
             */
            return matches?.length
                ? cleanContext(matches.map(m => m.content))
                : "";

        } catch (error) {
            console.error("RAG Retrieval Error:", error);
            return "";
        }
    },

    /**
     * 🔹 INGESTION (UNCHANGED, JUST SAFER)
     */
    ingestMessage: async (fileId, messageId, text) => {
        try {
            if (!text || text.length < 5) return;

            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: trimForEmbedding(text),
            });

            const [{ embedding }] = response.data;

            const { error } = await supabaseAdmin.from('claim_embeddings').insert({
                claim_id: fileId,
                message_id: messageId,
                content: text,
                embedding: embedding
            });

            if (error) throw error;

            console.log(`✅ Ingested message ${messageId}`);
        } catch (error) {
            console.error("Vector Ingestion Error:", error);
        }
    }
};

module.exports = ContextService;