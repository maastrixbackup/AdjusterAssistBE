const { supabaseAdmin } = require('../config/supabase');

const File = {
    /**
     * 1. Create a new File (Mandatory Fields)
     * Note: user_id is now a UUID string, not an integer.
     */
    create: async (fileData) => {
        const { 
            user_id, 
            claim_number, 
            client_name, 
            policy_form,
            date_of_loss, 
            reported_date, 
            loss_type, 
            address,
            jurisdiction, 
            line_of_business, 
            claim_stage 
        } = fileData;

        // Validation Check
        if (!user_id || !claim_number || !client_name) {
            throw new Error("Missing required fields: user_id, claim_number, or client_name");
        }

        const { data, error } = await supabaseAdmin
            .from('files')
            .insert([
                {
                    user_id: user_id, // Removed parseInt() - must be UUID string
                    claim_number,
                    client_name,
                    policy_form: policy_form || '',
                    date_of_loss: date_of_loss || new Date().toISOString().split('T')[0],
                    reported_date: reported_date || new Date().toISOString().split('T')[0],
                    loss_type: loss_type || 'water',
                    address: address || '',
                    jurisdiction: jurisdiction || 'CT',
                    line_of_business: line_of_business || 'homeowners',
                    claim_stage: claim_stage || 'mitigation_review',
                    status: 'active'
                }
            ])
            .select();

        if (error) {
            console.error("Supabase Insert Error:", error.message);
            throw error;
        }
        return data[0];
    },

    /**
     * 2. Get all files for a specific adjuster
     */
    findByUserId: async (userId) => {
        const { data, error } = await supabaseAdmin
            .from('files')
            .select('*')
            .eq('user_id', userId) // userId is a UUID string
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
    findById: async (fileId) => {
        const { data, error } = await supabaseAdmin
            .from('files')
            .select('*')
            .eq('id', fileId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Error fetching file by ID:", error.message);
            throw error;
        }
        return data;
    },

    /**
     * 4. Update file metadata
     */
    update: async (fileId, updateData) => {
        const { data, error } = await supabaseAdmin
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
    delete: async (fileId) => {
        const { data, error } = await supabaseAdmin
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
    findMostRecent: async (userId) => {
        const { data, error } = await supabaseAdmin
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