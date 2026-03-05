const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middlewares/auth.middleware');
const router = express.Router();

const users = [];

// SIGNUP
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword);
        users.push({ email, password: hashedPassword });
        res.status(201).json({ message: "User registered successfully!" });
    } catch (err) {
        res.status(500).send();
    }
});

// LOGIN ROUTE
router.post('/login', async (req, res) => {
    try {
        const user = users.find(u => u.email === req.body.email);
        if (!user) return res.status(400).json({ message: "User not found" });

        const validPass = await bcrypt.compare(req.body.password, user.password);
        // console.log(validPass)
        if (!validPass) return res.status(400).json({ message: "Invalid password" });

        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log(token)
        res.json({ token });
    } catch (error) {
        res.status(500).json({ "message": "Internal Server Error" })
        console.log(error)
    }
});

console.log('Middleware Check:', verifyToken);

router.get('/profile', verifyToken, (req, res) => {
    console.log(users)
    res.json({ message: "This is private data"});
});

module.exports = router;