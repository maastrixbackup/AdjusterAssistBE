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
};

module.exports = UserModel;