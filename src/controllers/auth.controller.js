const bcrypt = require("bcrypt");
const { generateToken } = require("../utils/jwt");
const User = require("../models/user");

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // FIX: Explicitly pass id and email
        const token = generateToken({ id: user.id, email: user.email });

        const userResponse = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            created_at: user.created_at,
            updated_at: user.updated_at,
        };

        res.status(200).json({
            success: true,
            message: "Login successful",
            user: userResponse,
            token: token,
        });
    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and password are required",
            });
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) { 
            return res.status(400).json({ 
                success: false, 
                message: "Email already in use", 
            }); 
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = await User.create({
            name,
            email,
            password: hashedPassword
        });

        // FIX: Don't pass the whole newUser object. 
        const token = generateToken({ id: newUser.id, email: newUser.email });

        return res.status(201).json({
            success: true,
            message: "User created successfully",
            user: newUser,
            token: token
        });

    } catch (error) {
        console.error("Signup Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error during registration" 
        });
    }
};

module.exports = { login, signup };