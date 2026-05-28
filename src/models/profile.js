const { createUserClient } = require('../config/supabase');

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
};

module.exports = UserModel;