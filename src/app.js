const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { connectDB, sequelize } = require('./config/db'); // Import DB tools
const authRoutes = require('./routes/auth.routes');

const app = express();

// 1. Connect to Database
connectDB();

sequelize.sync({ force: false }) 
    .then(() => console.log("Database models synced"))
    .catch(err => console.log("Sync error:", err));

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("AdjusterAssist API running");
});

// 3. Routes
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});