const { createUserClient, supabaseAdmin } = require('../config/supabase');

const File = {
    create: async (supabase, fileData) => {
        const { data, error } = await supabase
            .from('files')
            .insert([fileData])
            .select()
            .single();

        if (error) throw error;

        return data;
    },

    findByUserId: async (supabase, userId) => {
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching files by user:", error.message);
            throw error;
        }

        return data;
    },

    /**
     * 3. Get a single file by ID (Internal ID is serial/integer)
     */
    findById: async (supabase, fileId) => {
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', fileId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return data;
    },


    update: async (supabase, fileId, updateData) => {
        const { data, error } = await supabase
            .from('files')
            .update({
                ...updateData,
                updated_at: new Date().toISOString(),
                last_activity_at: new Date().toISOString() // Keep track of latest interaction
            })
            .eq('id', fileId)
            .select();

        if (error) {
            console.error("Supabase Update Error:", error.message);
            throw error;
        }
        return data[0];
    },

    /**
     * 5. Delete a file
     */
    delete: async (supabase, fileId) => {
        const { data, error } = await supabase
            .from('files')
            .delete()
            .eq('id', fileId)
            .select();

        if (error) {
            console.error("Supabase Delete Error:", error.message);
            throw error;
        }
        return data[0];
    },

    /**
     * 6. Get the most recent file for the workspace
     */
    findMostRecent: async (supabase, userId) => {
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', userId)
            .order('last_activity_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Error finding most recent file:", error.message);
            throw error;
        }
        return data;
    }
};

module.exports = File;