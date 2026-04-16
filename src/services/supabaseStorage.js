import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY 
);

const BUCKET_NAME = 'claims-attachments';

export const supabaseStorage = {
  /**
   * Uploads multiple files to Supabase and returns an array of public URLs
   * @param {Array} files - The req.files array from Multer
   * @returns {Promise<Array<string>>} - Array of public URLs
   */
  async uploadAttachments(files) {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map(async (file) => {
      try {
        // 1. Prepare unique file path: folder/timestamp-name.ext
        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExt}`;
        const filePath = `${fileId}/${fileName}`;
        
        // 2. Read file from local disk (where Multer saved it)
        const fileBuffer = fs.readFileSync(file.path);

        // 3. Upload to Supabase
        const { data, error } = await supabase.storage
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

        // 5. Clean up local file (Delete from your 8GB PC disk)
        fs.unlinkSync(file.path);

        return publicUrl;
      } catch (err) {
          console.error(`Upload failed for ${file.originalname}:`, err.message);
          return null;
      }
    });

    const urls = await Promise.all(uploadPromises);
    return urls.filter(url => url !== null); // Remove failed uploads
  }
};