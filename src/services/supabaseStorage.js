import supabase from "../config/supabase.js";
import fs from "fs";
import path from "path"

const BUCKET_NAME = 'claims-attachments';

export const supabaseStorage = {
  async uploadAttachments(files) {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map(async (file) => {
      try {
        // 1. Identify File Type for Folder Organization
        const isImage = file.mimetype.startsWith('image/');
        const isPDF = file.mimetype === 'application/pdf';
        
        // Organize into folders: 'images/', 'docs/', or 'others/'
        let folder = 'others';
        if (isImage) folder = 'images';
        else if (isPDF) folder = 'docs';

        // 2. Preserve Original Extension
        // Multer removes extensions from file.path, so we grab it from originalname
        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        // 3. Read and Upload
        const fileBuffer = fs.readFileSync(file.path);

        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, fileBuffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (error) throw error;

        // 4. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        return publicUrl;
      } catch (err) {
        console.error(`Supabase Upload Error [${file.originalname}]:`, err.message);
        return null;
      }
      // Note: We handle fs.unlinkSync in the controller's .finally() block 
      // to ensure AI service can read the file before it's deleted.
    });

    const results = await Promise.all(uploadPromises);
    return results.filter(url => url !== null);
  }
};