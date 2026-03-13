const db = require("../config/db");

const Draft = {
  // Save a generated draft into a specific File Workspace
  create: async (draftData) => {
    const { file_id, user_id, draft_type, content } = draftData;
    const [result] = await db.query(
      "INSERT INTO drafts (file_id, user_id, draft_type, content) VALUES (?, ?, ?, ?)",
      [file_id, user_id, draft_type, content]
    );
    return { id: result.insertId, ...draftData };
  },

  // Fetch all drafts belonging to a specific File (The Workspace view)
  findByFileId: async (fileId) => {
    const [rows] = await db.query(
      "SELECT * FROM drafts WHERE file_id = ? ORDER BY created_at DESC",
      [fileId]
    );
    return rows;
  },

  // Delete a draft (if the user wants to remove it from the workspace)
  delete: async (draftId) => {
    return await db.query("DELETE FROM drafts WHERE id = ?", [draftId]);
  }
};

module.exports = Draft;