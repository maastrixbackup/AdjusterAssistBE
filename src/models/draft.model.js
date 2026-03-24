const supabase = require('../config/supabase');

const Draft = {
  
  // 1. Create a new AI Draft
  create: async (draftData) => {
    const { file_id, user_id, draft_type, content } = draftData;
    
    const { data, error } = await supabase
      .from('drafts')
      .insert([
        { 
          file_id, 
          user_id, 
          draft_type, 
          content 
        }
      ])
      .select();

    if (error) throw error;
    return data[0];
  },

  // 2. Find a specific draft by ID
  findById: async (draftId) => {
    const { data, error } = await supabase
      .from('drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // 3. Get all drafts belonging to a specific file/workspace
  findByFileId: async (fileId) => {
    const { data, error } = await supabase
      .from('drafts')
      .select('*')
      .eq('file_id', fileId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 4. Delete a specific draft
  deleteById: async (draftId) => {
    const { error } = await supabase
      .from('drafts')
      .delete()
      .eq('id', draftId);

    if (error) throw error;
    return true;
  },

  // 5. Get recent drafts with File info (JOIN equivalent)
  findRecent: async (userId, limit = 5) => {
    const { data, error } = await supabase
      .from('drafts')
      .select(`
        *,
        files (
          claim_number,
          client_name
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  // 6. Get all drafts for a user with File info
  findAllByUser: async (userId) => {
    const { data, error } = await supabase
      .from('drafts')
      .select(`
        *,
        files (
          claim_number,
          client_name
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};

module.exports = Draft;