const supabase = require('../config/supabase');

const File = {
  // 1. Create a new Workspace (File)
  create: async (fileData) => {
    const { user_id, claim_number, policy_number, client_name } = fileData;

    const { data, error } = await supabase
      .from('files') // Matches the new Supabase table name
      .insert([
        {
          user_id,
          claim_number,
          policy_number,
          client_name,
          status: 'active'
        }
      ])
      .select();

    if (error) throw error;
    return data[0];
  },

  // 2. Get all files for a specific adjuster
  findByUserId: async (userId) => {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 3. Get a single workspace by ID
  findById: async (fileId) => {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // 4. Update file metadata (status, client name, etc.)
  update: async (fileId, updateData) => {
    const { client_name, status, claim_number, policy_number } = updateData;

    const { data, error } = await supabase
      .from('files')
      .update({
        client_name,
        status,
        claim_number,
        policy_number
      })
      .eq('id', fileId)
      .select();

    if (error) throw error;
    return data[0];
  },

  // 5. Delete a workspace (Recommended for full CRUD)
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