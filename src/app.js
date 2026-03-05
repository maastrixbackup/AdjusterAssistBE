const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { connectDB, sequelize } = require('./config/db'); // Import DB tools
const authRoutes = require('./routes/auth.routes');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes')

const app = express();


app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("AdjusterAssist API running");
});

// 3. Routes
app.use('/api/auth', authRoutes);
app.use("/api/user", userRoutes)

module.exports = app;
