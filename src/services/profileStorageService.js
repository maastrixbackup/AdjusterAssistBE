const { supabaseAdmin } = require("../config/supabase");

const BUCKET = "profile_image";

const uploadAvatar = async (fileBuffer, fileName, mimeType) => {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);

    return {
      path: data.path,
      publicUrl,
    };
  } catch (error) {
    console.error("Supabase Storage Error:", error.message);

    throw new Error("Failed to upload image to cloud storage");
  }
};

module.exports = {
  uploadAvatar,
};
