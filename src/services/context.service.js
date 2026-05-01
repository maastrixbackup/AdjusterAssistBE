const OpenAI = require('openai');
const supabase = require('../config/supabase.js');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ContextService = {
    rewriteQuery: async (userInput, history = []) => {
        try {
            const chatContext = history
                .map(m => `User: ${m.user_input}\nAI: ${m.ai_response}`)
                .join("\n\n");

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are an insurance search optimizer. Use the provided chat history to turn the user's latest command into a standalone factual search query. Focus on incident details, dates, and names. Output ONLY the rewritten query."
                    },
                    { role: "user", content: `Recent History:\n${chatContext}\n\nUser Command: ${userInput}` }
                ],
                temperature: 0,
            });
            return response.choices[0].message.content;
        } catch (err) {
            return userInput;
        }
    },

    getRelevantContext: async (fileId, userInput) => {
        try {
            // 1. Initial Direct Search
            const directEmbeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: userInput,
            });

            let { data: matches, error } = await supabase.rpc('match_claim_context', {
                query_embedding: directEmbeddingResponse.data[0].embedding,
                match_threshold: 0.5,
                match_count: 5,
                target_claim_id: fileId,
            });

            // 2. The Fallback: Detect "Convert/Make/Draft" commands or RAG failure
            const isConversionCommand = /convert|make|draft|turn|create/i.test(userInput);

            if (isConversionCommand || !matches || matches.length === 0) {
                console.log("[RAG] Short command or RAG Gap detected. Fetching immediate context...");

                // Fetch the last 3-5 messages to satisfy the client's request
                const { data: historyData, error: historyError } = await supabase
                    .from('claim_messages')
                    .select('user_input, ai_response')
                    .eq('workspace_id', fileId)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (!historyError && historyData && historyData.length > 0) {
                    // This is the most critical part: identifying the "Parent" response
                    const lastAIResponse = historyData[0].ai_response;
                    const lastUserInput = historyData[0].user_input;

                    // A. Rewrite query using the history for a second RAG attempt
                    const history = [...historyData].reverse();
                    const optimizedQuery = await ContextService.rewriteQuery(userInput, history);
                    console.log("[RAG] Optimised Query: ", optimizedQuery)

                    const retryEmbedding = await openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: optimizedQuery,
                    });

                    const { data: retryMatches } = await supabase.rpc('match_claim_context', {
                        query_embedding: retryEmbedding.data[0].embedding,
                        match_threshold: 0.35,
                        match_count: 5,
                        target_claim_id: fileId,
                    });

                    // B. Combine Everything: Prioritize the immediate prior turn
                    const vectorContext = (retryMatches || []).map(m => m.content).join("\n---\n");

                    // We explicitly label the immediate parent so the LLM knows exactly what "this" is
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

            return matches.length > 0 ? matches.map(m => m.content).join("\n---\n") : "";
        } catch (error) {
            console.error("RAG Retrieval Error:", error);
            return "";
        }
    },

    ingestMessage: async (fileId, messageId, text) => {
        try {
            if (!text || text.length < 5) return;

            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
            });
            const [{ embedding }] = response.data;

            const { error } = await supabase.from('claim_embeddings').insert({
                claim_id: fileId, //// Refers to Workspace ID
                message_id: messageId,
                content: text,
                embedding: embedding
            });

            if (error) throw error;
            console.log(`Successfully ingested message ${messageId} into vector store.`);
        } catch (error) {
            console.error("Vector Ingestion Error:", error);
        }
    }
};

// Export using CommonJS
module.exports = ContextService;