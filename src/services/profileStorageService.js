const supabase = require("../config/supabase")

const uploadAvatar = async (fileBuffer, fileName, mimeType) => {
  try {
    const { data, error } = await supabase.storage
      .from('profile_image') // Make sure this bucket exists in Supabase
      .upload(fileName, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) throw error;

    // Retrieve the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile_image')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error("Supabase Storage Error:", error.message);
    throw new Error("Failed to upload image to cloud storage");
  }
};

module.exports = { uploadAvatar };