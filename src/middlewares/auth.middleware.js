
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // console.log("Auth Header Received:", authHeader);

    const token = authHeader && authHeader.split(' ')[1];
    // console.log("Extracted Token:", token); 

    if (!token) return res.status(401).json({ message: "Access Denied" });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        console.log("JWT Error:", err.message);
        res.status(403).json({ message: "Invalid or Expired Token" });
    }
};

module.exports = verifyToken