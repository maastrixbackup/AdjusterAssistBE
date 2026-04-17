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
  async uploadAttachments(files) {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map(async (file) => {
      let filePath = `file/${Date.now()}-${path.basename(file.path)}`;
      try {
        const fileBuffer = fs.readFileSync(file.path);

        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, fileBuffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        return publicUrl;
      } catch (err) {
        console.error(`Supabase Upload Error [${file.originalname}]:`, err.message);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    return results.filter(url => url !== null);
  }
};