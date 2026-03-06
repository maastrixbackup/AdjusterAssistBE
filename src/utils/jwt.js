const jwt = require("jsonwebtoken");

// Ensure you use 'id' in the payload
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email }, 
        process.env.JWT_SECRET, 
        { expiresIn: "24h" }
    );
};

const verifyToken = (token) => {
    try {
        // The 'return' here is mandatory!
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        console.error("JWT Verify Error:", error.message);
        return null;
    }
};

module.exports = { generateToken, verifyToken };