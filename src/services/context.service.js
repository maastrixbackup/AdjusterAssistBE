const OpenAI = require('openai');
const supabase = require('../config/supabase.js'); 

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ContextService = {
    rewriteQuery: async (userInput, history = []) => {
       try {
         const chatContext = history.map(h => `${h.role}: ${h.content}`).join("\n");
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", 
            messages: [
                { 
                    role: "system", 
                    content: "Convert the user's latest command into a specific search query based on the conversation history. Focus on nouns and claim details. Example: 'Convert to FNOL' -> 'incident date, driver details, vehicle damage, location'." 
                },
                { role: "user", content: `History:\n${chatContext}\n\nLatest Input: ${userInput}` }
            ],
            temperature: 0,
        });
        return response.choices[0].message.content;
       } catch (error) {
        console.log("[RAG] Rewrite Query Error: ",error)
       }
    },

    getRelevantContext: async (fileId, userInput) => {
        try {
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: userInput,
            });
            const [{ embedding }] = embeddingResponse.data;

            const { data: matches, error } = await supabase.rpc('match_claim_context', {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: 5,
                target_claim_id: fileId,
            });

            if (error) throw error;

            // --- STEP 2: Conditional Check ---
            if (matches.length === 0) {
                console.log("[RAG] No relevant embeddings found. Fetching history to rewrite query...");

                // Fetch last 5 messages for this specific claim
                const { data: recentMessages } = await supabase
                    .from('claim_embeddings')
                    .select('content')
                    .eq('claim_id', fileId)
                    .order('id', { ascending: false })
                    .limit(5);

                if (recentMessages && recentMessages.length > 0) {
                    // Rewrite the query using the history
                    const optimizedQuery = await ContextService.rewriteQuery(userInput, recentMessages);
                    console.log("Searching for rewritten query:", optimizedQuery);

                    // Re-run the search with optimized query
                    const retryEmbedding = await openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: optimizedQuery,
                    });

                    const { data: retryMatches } = await supabase.rpc('match_claim_context', {
                        query_embedding: retryEmbedding.data[0].embedding,
                        match_threshold: 0.35, // Relax threshold slightly
                        match_count: 7,
                        target_claim_id: fileId,
                    });

                    matches = retryMatches || [];
                }
            }

            // ----------------------------------------//
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