const { createUserClient, supabaseAdmin } = require('../config/supabase');

const UserModel = {

  async findById(supabase, id) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    return data;
  },

  async updateProfile(supabase, userId, profileData) {
    const { data, error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  async updatePushToken(supabase, userId, token) {

    const { data, error } = await supabase
      .from('profiles')
      .update({
        expo_push_token: token
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  async deleteAccount(userId) {
    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileDeleteError) {
      throw profileDeleteError;
    }
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      throw authDeleteError;
    }
    return true;
  },

  async createDeletionRequest(userId, email) {
    const { data: existingRequest, error: existingError } = await supabaseAdmin
      .from("account_deletion_requests")
      .select("id, status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingRequest) {
      return {
        alreadyPending: true,
        request: existingRequest,
      };
    }
    const { data, error } = await supabaseAdmin
      .from("account_deletion_requests")
      .insert({
        user_id: userId,
        email,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    return {
      alreadyPending: false,
      request: data,
    };
  }
};

module.exports = UserModel;