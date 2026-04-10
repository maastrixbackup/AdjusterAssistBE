import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Saves a base64 image string to the local filesystem
 * @param {string} base64String - The raw base64 string
 * @param {string} folder - Subfolder name (e.g., 'claims', 'receipts')
 * @returns {string} - The relative path to the stored image
 */
export const storeBase64Image = async (base64String, folder = 'uploads') => {
    if (!base64String) return null;

    try {
        // 1. Ensure the upload directory exists
        const uploadDir = path.join(process.cwd(), 'data', folder);
        if (!fs.existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        // 2. Clean the base64 string (remove data:image/jpeg;base64, if present)
        const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
        
        // 3. Create a unique filename
        const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        const filePath = path.join(uploadDir, fileName);

        // 4. Convert base64 to Buffer and Save
        const buffer = Buffer.from(base64Data, 'base64');
        await writeFile(filePath, buffer);

        // Return the relative path for database storage
        return `data/${folder}/${fileName}`;
    } catch (error) {
        console.error("Storage Service Error:", error);
        throw new Error("Failed to save image locally");
    }
};