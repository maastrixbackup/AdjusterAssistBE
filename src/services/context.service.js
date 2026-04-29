const OpenAI = require('openai');
const supabase = require('../config/supabase.js'); 

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ContextService = {
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