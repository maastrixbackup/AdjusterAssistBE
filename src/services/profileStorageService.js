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

    if (error) throw error;

    const { data: signedData, error: signedError } =
      await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(data.path, 60 * 60);

    if (signedError) throw signedError;

    return {
      path: data.path,
      signedUrl: signedData.signedUrl,
    };
  } catch (error) {
    console.error("Supabase Storage Error:", error.message);
    throw new Error("Failed to upload image to cloud storage");
  }
};

module.exports = { uploadAvatar };