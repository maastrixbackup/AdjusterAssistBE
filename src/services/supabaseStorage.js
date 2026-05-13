import { supabaseAdmin } from "../config/supabase.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const BUCKET_NAME = "claims-attachments";

export const supabaseStorage = {
  async uploadAttachments(files, userId, workspaceId) {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map(async (file) => {
      try {

        // File type folder
        let folder = "others";

        if (file.mimetype.startsWith("image/")) {
          folder = "images";
        } else if (file.mimetype === "application/pdf") {
          folder = "docs";
        }

        // Secure random filename
        const fileExt = path.extname(file.originalname);

        const fileName = `${crypto.randomUUID()}${fileExt}`;

        // Secure hierarchical path
        const filePath =
          `${userId}/${workspaceId}/${folder}/${fileName}`;

        // Read file
        const fileBuffer = fs.readFileSync(file.path);

        // Upload to PRIVATE bucket
        const { error } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(filePath, fileBuffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (error) throw error;

        // RETURN STORAGE PATH ONLY
        return {
          storagePath: filePath,
          metadata: {
            original_name: file.originalname,
            mime_type: file.mimetype,
            size: file.size,
          }
        };

      } catch (err) {
        console.error(
          `Supabase Upload Error [${file.originalname}]:`,
          err.message
        );

        return null;
      }
    });

    const results = await Promise.all(uploadPromises);

    return results.filter(Boolean);
  },
};


const getSignedUrl = async (req, res) => {
  try {
    const { path: filePath, workspaceId } = req.query;

    const userId = req.user.id;

    // Validate workspace ownership
    const workspace = await validateWorkspaceAccess(
      req.supabase,
      workspaceId,
      userId
    );

    // Ensure path belongs to user
    if (!filePath.startsWith(`${userId}/${workspaceId}/`)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized file access"
      });
    }

    // Create temporary signed URL
    const { data, error } = await supabaseAdmin.storage
      .from("claims-attachments")
      .createSignedUrl(filePath, 60 * 5); // 5 min

    if (error) throw error;

    return res.json({
      success: true,
      signedUrl: data.signedUrl
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Could not generate file URL"
    });
  }
};