const supabase = require('../config/supabase');

const UserModel = {
  // 1. Find all users (Used in getAllUsers for Admin Dashboard)
  async findAll() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 2. Find user by Primary Key ID (Used in getProfile)
  async findById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // 3. Find user by email (For Login/Signup checks)
  async findByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // 4. Create new user (For Registration)
  async create(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select();

    if (error) throw error;
    return data[0];
  },

  // 5. Update password (Used in resetPassword)
  async updatePassword(id, newHashedPassword) {
    const { data, error } = await supabase
      .from('users')
      .update({
        password: newHashedPassword,
        reset_token: null,          
        reset_token_expires: null   
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    return data[0];
  },

  // 6. Find user by a valid reset token
  async findByResetToken(token) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('reset_token', token)
      // Ensure token hasn't expired (Postgres handles ISO strings automatically)
      .gt('reset_token_expires', new Date().toISOString())
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // 7. Set Reset Token (For Forgot Password flow)
  async updateResetToken(userId, token, expires) {
    const { data, error } = await supabase
      .from('users')
      .update({ reset_token: token, reset_token_expires: expires })
      .eq('id', userId)
      .select();

    if (error) throw error;
    return data[0];
  },
  // 8. Save/Update Expo Push Token (For Notifications)
  async updatePushToken(userId, token) {
    const { data, error } = await supabase
      .from('users')
      .update({ expo_push_token: token })
      .eq('id', userId)
      .select();

    if (error) throw error;
    return data[0];
  },

  //9. Update user profile (name, avatar_url, etc.)
  async updateProfile(userId, profileData) {
    const { data, error } = await supabase
      .from('users')
      .update(profileData)
      .eq('id', userId)
      .select()
      .single();
    
      if (error) throw error;
    return data;
  }
};


module.exports = UserModel;