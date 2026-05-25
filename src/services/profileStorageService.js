const crypto = require("crypto");
const { supabaseAdmin } = require("../config/supabase");

const BUCKET = "profile_image";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function getSafeExtension(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

function sanitizeUserId(userId) {
  return String(userId).replace(/[^a-zA-Z0-9-_]/g, "");
}

const uploadAvatar = async (
  fileBuffer,
  originalFileName,
  mimeType,
  userId,
) => {
  try {
    if (!fileBuffer) {
      return null;
    }

    if (!Buffer.isBuffer(fileBuffer)) {
      throw new Error("Invalid file buffer");
    }

    if (fileBuffer.length === 0) {
      return null;
    }

    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error("Image size must be less than 5MB");
    }

    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error("Invalid image type");
    }

    if (!userId) {
      throw new Error("User ID is required");
    }

    const ext = getSafeExtension(mimeType);

    if (!ext) {
      throw new Error("Unsupported image format");
    }

    const safeUserId = sanitizeUserId(userId);

    if (!safeUserId) {
      throw new Error("Invalid user ID");
    }

    const filePath = `avatars/${safeUserId}/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
        upsert: false,
        cacheControl: "3600",
      });

    if (error) {
      throw error;
    }

    if (!data?.path) {
      throw new Error("Upload completed but storage path was not returned");
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);

    if (!publicUrl) {
      throw new Error("Public URL was not generated");
    }

    return {
      path: data.path,
      publicUrl,
    };
  } catch (error) {
    console.error("Supabase Storage Error:", {
      message: error.message,
      bucket: BUCKET,
      mimeType,
      originalFileName,
      userId,
      size: fileBuffer?.length || 0,
    });

    throw new Error("Failed to upload image to cloud storage");
  }
};

module.exports = { uploadAvatar };