const jwt = require("jsonwebtoken");

const generateToken = (payload) => {
    return jwt.sign({ ...payload }, process.env.JWT_SECRET, { expiresIn: '7d' });
};


const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        // Re-throw the error so the middleware knows exactly why it failed
        throw new Error(error.message);
    }
};

module.exports = { generateToken, verifyToken };