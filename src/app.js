const express = require("express");
const cors = require("cors");
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const draftRoutes = require('./routes/draft.routes');
const subscriptionRoutes = require('./routes/subscription.routes');

const app = express();


app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("AdjusterAssist API running");
});

// 3. Routes
app.use('/api/v1/auth', authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/drafts", draftRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);

module.exports = app;
