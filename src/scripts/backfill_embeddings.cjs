const supabase = require('../config/supabase.js').default || require('../config/supabase.js');
const ContextService = require('../services/context.service.js');

async function backfill() {
    console.log("--- Starting Backfill Process for Workspace Messages ---");

    // 1. Fetch existing messages
    const { data: messages, error } = await supabase
        .from('claim_messages')
        .select('id, workspace_id, user_input, ai_response')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching messages:", error);
        return;
    }

    console.log(`Found ${messages.length} database entries to process.`);

    for (const msg of messages) {
        try {
            // A. Process User Input (The 'Evidence')
            if (msg.user_input && msg.user_input.length > 5) {
                console.log(`Ingesting User Input for Message ID: ${msg.id}`);
                const userInputText = `[User/Insured Input]: ${msg.user_input}`;
                await ContextService.ingestMessage(msg.workspace_id, msg.id, userInputText);
            }

            // B. Process AI Response (The 'Analysis')
            if (msg.ai_response && msg.ai_response.length > 10) {
                console.log(`Ingesting AI Response for Message ID: ${msg.id}`);
                // We add a prefix so the vector "knows" this was an AI summary/draft
                const aiText = `[Past AI Draft/Response]: ${msg.ai_response}`;
                await ContextService.ingestMessage(msg.workspace_id, msg.id, aiText);
            }

            // Small delay to prevent OpenAI rate limiting
            await new Promise(resolve => setTimeout(resolve, 150));

        } catch (err) {
            console.error(`Error on Message ${msg.id}:`, err.message);
        }
    }

    console.log("--- Backfill Complete ---");
}

backfill();