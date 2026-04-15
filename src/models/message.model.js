const supabase = require('../config/supabase'); // Your Supabase client config

const Message = {
  // 1. Create a new message
  create: async (messageData) => {
    const { data, error } = await supabase
      .from('claim_messages')
      .insert([messageData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 2. Find by message ID
  findById: async (id) => {
    const { data, error } = await supabase
      .from('claim_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // 3. Find by Workspace ID (Mapping findByFileId to workspace_id per your schema)
  findByFileId: async (workspaceId) => {
    const { data, error } = await supabase
      .from('claim_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  // 4. Update message by ID
  updateById: async (id, updateData) => {
    const { data, error } = await supabase
      .from('claim_messages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 5. Delete message by ID
  deleteById: async (id) => {
    const { error } = await supabase
      .from('claim_messages')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // 6. Find recent messages (e.g., for a dashboard or quick view)
  findRecent: async (limit = 10) => {
    const { data, error } = await supabase
      .from('claim_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  // 7. Find all messages for a specific user
  findAllByUser: async (userId) => {
    const { data, error } = await supabase
      .from('claim_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};

module.exports = Message;