const { supabaseAdmin } = require('../config/supabase');

const Message = {
    /**
     * 1. Create a new interaction (Message)
     * messageData should include: workspace_id, user_id (UUID), user_input, ai_response, etc.
     */
    create: async (messageData) => {
        const { data, error } = await supabaseAdmin
            .from('claim_messages')
            .insert([messageData])
            .select()
            .single();

        if (error) {
            console.error("Message Creation Error:", error.message);
            throw error;
        }
        return data;
    },

    /**
     * 2. Find a single message by its serial ID
     */
    findById: async (id) => {
        const { data, error } = await supabaseAdmin
            .from('claim_messages')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Error finding message:", error.message);
            throw error;
        }
        return data;
    },

    /**
     * 3. Fetch the conversation history for a specific workspace (Claim)
     */
    findByWorkspaceId: async (workspaceId) => {
        const { data, error } = await supabaseAdmin
            .from('claim_messages')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error fetching workspace history:", error.message);
            throw error;
        }
        return data;
    },

    /**
     * 4. Update message (e.g., mark response_used = true or update refinement)
     */
    updateById: async (id, updateData) => {
        const { data, error } = await supabaseAdmin
            .from('claim_messages')
            .update({
                ...updateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error("Message Update Error:", error.message);
            throw error;
        }
        return data;
    },

    /**
     * 5. Delete message (Careful: CASCADE is active in DB for versions/parents)
     */
    deleteById: async (id) => {
        const { error } = await supabaseAdmin
            .from('claim_messages')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Message Deletion Error:", error.message);
            throw error;
        }
        return true;
    },

    /**
     * 6. Find all messages for an adjuster (UUID based)
     */
    findAllByUser: async (userId) => {
        const { data, error } = await supabaseAdmin
            .from('claim_messages')
            .select('*')
            .eq('user_id', userId) // userId is a UUID string
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching user messages:", error.message);
            throw error;
        }
        return data;
    }
};

module.exports = Message;