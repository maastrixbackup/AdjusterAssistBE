const db = require("../config/db");

const File = {
  // Create a new Workspace
  create: async (fileData) => {
    const { user_id, claim_number, policy_number, client_name } = fileData;
    const [result] = await db.query(
      "INSERT INTO files (user_id, claim_number, policy_number, client_name, status) VALUES (?, ?, ?, ?, 'active')",
      [user_id, claim_number, policy_number, client_name]
    );
    return { id: result.insertId, ...fileData };
  },

  // Get all workspaces for a specific adjuster
  findByUserId: async (userId) => {
    const [rows] = await db.query(
      "SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    return rows;
  },

  // Get a single workspace by ID (for the specific File view)
  findById: async (fileId) => {
    const [rows] = await db.query("SELECT * FROM files WHERE id = ?", [fileId]);
    return rows[0];
  },

  // Update file metadata (status, client name, etc.)
  update: async (fileId, updateData) => {
    const { client_name, status, claim_number } = updateData;
    return await db.query(
      "UPDATE files SET client_name = ?, status = ?, claim_number = ? WHERE id = ?",
      [client_name, status, claim_number, fileId]
    );
  }
};

module.exports = File;