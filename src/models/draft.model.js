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
  },

  findRecent: async (userId, limit = 5) => {
    const [rows] = await db.query(
      `SELECT d.*, f.claim_number, f.client_name 
       FROM drafts d
       JOIN files f ON d.file_id = f.id
       WHERE d.user_id = ? 
       ORDER BY d.created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );
    return rows;
  },

  findAllByUser: async (userId) => {
    const [rows] = await db.query(
      `SELECT d.*, f.claim_number, f.client_name 
       FROM drafts d
       JOIN files f ON d.file_id = f.id
       WHERE d.user_id = ? 
       ORDER BY d.created_at DESC`,
      [userId]
    );
    return rows;
  }
};

module.exports = Draft;