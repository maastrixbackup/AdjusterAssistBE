const express = require("express");
const cors = require("cors");
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const draftRoutes = require('./routes/draft.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const fileRoutes = require('./routes/file.routes');
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("../swagger.json");

const app = express();

// add this line
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customSiteTitle: "Adjuster Assist API Docs",
  })
);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("AdjusterAssist API running");
});

// 3. Routes
app.use('/api/v1/auth', authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/drafts", draftRoutes);
app.use("/api/v1/files", fileRoutes);

module.exports = app;
