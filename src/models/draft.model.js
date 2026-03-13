const db = require("../config/db");

const Draft = {
  create: async (draftData) => {
    const { file_id, user_id, draft_type, content } = draftData;
    const [result] = await db.query(
      "INSERT INTO drafts (file_id, user_id, draft_type, content) VALUES (?, ?, ?, ?)",
      [file_id, user_id, draft_type, content]
    );

    // Ensure we actually got an ID back
    if (result && result.insertId) {
      return { id: result.insertId, ...draftData };
    }
    return null;
  },

  findById: async (draftId) => {
    const [rows] = await db.query("SELECT * FROM drafts WHERE id = ?", [draftId]);
    return rows[0];
  },


  findByFileId: async (fileId) => {
    const [rows] = await db.query(
      "SELECT * FROM drafts WHERE file_id = ? ORDER BY created_at DESC",
      [fileId]
    );
    return rows;
  },

  deleteById: async (draftId) => {
    return await db.query("DELETE FROM drafts WHERE id = ?", [draftId]);
  }
};

module.exports = Draft;