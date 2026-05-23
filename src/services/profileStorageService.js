const crypto = require("crypto");
const { supabaseAdmin } = require("../config/supabase");

const BUCKET = "profile_image";

function getSafeExtension(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

const uploadAvatar = async (fileBuffer, originalFileName, mimeType, userId) => {
  try {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error("Invalid image type");
    }

    if (!userId) {
      throw new Error("User ID is required");
    }

    const ext = getSafeExtension(mimeType);

    if (!ext) {
      throw new Error("Unsupported image format");
    }

    const filePath = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) throw error;

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

module.exports = { uploadAvatar };
