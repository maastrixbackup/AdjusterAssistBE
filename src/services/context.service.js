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
            // 1. Initial Direct Search (Same as before)
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

            // 2. The Fallback logic
            if ((!matches || matches.length === 0)) {
                console.log("RAG Gap detected. Fetching history from claim_messages...");

                // Fetch 5 most recent messages from claim_messages table
                const { data: historyData, error: historyError } = await supabase
                    .from('claim_messages')
                    .select('user_input, ai_response')
                    .eq('workspace_id', fileId) // workspace_id is your FK to files
                    .order('created_at', { ascending: false })
                    .limit(3);

                if (!historyError && historyData && historyData.length > 0) {
                    // Reverse to put in chronological order (Oldest to Newest)
                    const history = historyData.reverse();

                    // Rewrite the query
                    const optimizedQuery = await ContextService.rewriteQuery(userInput, history);
                    console.log("[RAG] Optimized Query for RAG:", optimizedQuery);

                    // Re-embed and Re-search
                    const retryEmbedding = await openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: optimizedQuery,
                    });

                    const { data: retryMatches } = await supabase.rpc('match_claim_context', {
                        query_embedding: retryEmbedding.data[0].embedding,
                        match_threshold: 0.35, // Lower threshold for rewritten queries
                        match_count: 8,
                        target_claim_id: fileId,
                    });

                    matches = retryMatches || [];
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