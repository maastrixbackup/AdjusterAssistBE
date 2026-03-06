const db = require("../config/db");

const User = {
    async findByEmail(email) {
        const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
            email,
        ]);
        return rows[0];
    },

};

module.exports = User;