const db = require("../config/db");

const User = {
    async findByEmail(email) {
        const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
            email,
        ]);
        return rows[0];
    },

    async findAll() {
        const [rows] = await db.query(
            "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC"
        );
        return rows;
    },

    async findById(id) {
        const [rows] = await db.query(
            "SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?", 
            [id]
        );
        return rows[0];
    },

    async create({ name, email, password }) {
        const [result] = await db.query(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, password]
        );
        return { id: result.insertId, name, email };
    },

    // Password RESET opeartion with DB
    async setResetToken(userId, token, expires) {
        await db.query(
            "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
            [token, expires, userId]
        );
    },
    async findByResetToken(token) {
        const [rows] = await db.query(
            "SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()",
            [token]
        );
        return rows[0];
    },
    async updatePassword(userId, newHashedPassword) {
        await db.query(
            "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
            [newHashedPassword, userId]
        );
    }

};

module.exports = User;