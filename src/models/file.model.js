const supabase = require('../config/supabase');

const File = {
  /**
   * 1. Create a new Workspace (File)
   * Includes new fields required for the Carrier Payload Builder
   */
  create: async (fileData) => {
    const { 
      user_id, 
      claim_number, 
      client_name, 
      date_of_loss, 
      reported_date, 
      loss_type, 
      policy_form, 
      address, 
      jurisdiction, 
      line_of_business, 
      claim_stage 
    } = fileData;

    const { data, error } = await supabase
      .from('files')
      .insert([
        {
          user_id,
          claim_number,
          client_name, // Maps to insured_name in payload
          date_of_loss: date_of_loss || '2026-01-28',
          reported_date: reported_date || '2026-01-29',
          loss_type: loss_type || 'water',
          policy_form: policy_form || '',
          address: address || '', // Maps to property_address in payload
          jurisdiction: jurisdiction || 'CT',
          line_of_business: line_of_business || 'homeowners',
          claim_stage: claim_stage || 'mitigation_review',
        }
      ])
      .select();

    if (error) throw error;
    return data[0];
  },

  /**
   * 2. Get all files for a specific adjuster
   */
  findByUserId: async (userId) => {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * 3. Get a single workspace by ID
   * Essential for fetching the metadata needed to "inflate" the AI payload
   */
  findById: async (fileId) => {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    // PGRST116 is the code for "no rows returned"
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * 4. Update file metadata
   * Updated to allow modifying the new carrier-specific fields
   */
  update: async (fileId, updateData) => {
    const { 
      client_name, 
      claim_number, 
      date_of_loss, 
      loss_type, 
      address, 
      claim_stage,
      jurisdiction 
    } = updateData;

    const { data, error } = await supabase
      .from('files')
      .update({
        client_name,
        claim_number,
        date_of_loss,
        loss_type,
        address,
        claim_stage,
        jurisdiction,
        updated_at: new Date().toISOString()
      })
      .eq('id', fileId)
      .select();

    if (error) throw error;
    return data[0];
  },

  /**
   * 5. Delete a workspace
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