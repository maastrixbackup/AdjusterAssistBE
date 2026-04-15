const supabase = require('../config/supabase');

const File = {
    /**
     * 1. Create a new File (Mandatory Fields)
     * We remove fallbacks to ensure the UI sends the required data.
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

        // Validation Check (Optional but recommended at the Model level)
        if (!user_id || !claim_number || !client_name) {
            throw new Error("Missing required fields: user_id, claim_number, or client_name");
        }

        const { data, error } = await supabase
            .from('files')
            .insert([
                {
                    user_id: parseInt(user_id), 
                    claim_number,
                    client_name,
                    policy_form,
                    date_of_loss,
                    reported_date,
                    loss_type,
                    address,
                    jurisdiction,
                    line_of_business,
                    claim_stage,
                    status: 'active' // Initial status set by system
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
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', parseInt(userId))
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * 3. Get a single file by ID
     */
    findById: async (fileId) => {
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', fileId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * 4. Update file metadata
     */
    update: async (fileId, updateData) => {
        // Create an update object with only the fields provided
        const { data, error } = await supabase
            .from('files')
            .update({
                ...updateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', fileId)
            .select();

        if (error) throw error;
        return data[0];
    },

    /**
     * 5. Delete a file
     */
    delete: async (fileId) => {
        const { error } = await supabase
            .from('files')
            .delete()
            .eq('id', fileId);

        if (error) {
            console.error("Supabase Delete Error:", error.message);
            throw error;
        }
        return true;
    }
};

module.exports = File;