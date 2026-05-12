const { supabaseAdmin } = require('../config/supabase');

const Message = {
    create: async (supabase, messageData) => {
        const { data, error } = await supabase
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
    
    findById: async (supabase, id) => {
        const { data, error } = await supabase
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

    
    findByWorkspaceId: async (supabase, workspaceId) => {
        const { data, error } = await supabase
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

  
    updateById: async (supabase, id, updateData) => {
        const { data, error } = await supabase
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


    deleteById: async (supabase, id) => {
        const { error } = await supabase
            .from('claim_messages')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Message Deletion Error:", error.message);
            throw error;
        }
        return true;
    },


    findAllByUser: async (supabase, userId) => {
        const { data, error } = await supabase
            .from('claim_messages')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching user messages:", error.message);
            throw error;
        }
        return data;
    }
};

module.exports = Message;