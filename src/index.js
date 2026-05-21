const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/profile.routes");
const draftRoutes = require("./routes/message.route");
const subscriptionRoutes = require("./routes/subscription.routes");
const fileRoutes = require("./routes/workspace.routes");
const notificationsRoutes = require("./routes/notifications.routes");

const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("../swagger.json");
const { sendPushNotification } = require("./utils/notificationHelper");
const { supabaseAdmin } = require("./config/supabase");
const { hasVerifiedMFA, getMFAStatus } = require("./services/auth/mfa.service");
const authMiddleware = require("./middlewares/auth.middleware");

const app = express();

// add this line
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customSiteTitle: "Adjuster Assist API Docs",
  }),
);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.send("AdjusterAssist API running");
});

// 3. Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/drafts", draftRoutes);
app.use("/api/v1/files", fileRoutes);
app.use("/api/v1", require("./services/speechToText"));
app.use("/api/v1/notifications", notificationsRoutes);

module.exports = app;
