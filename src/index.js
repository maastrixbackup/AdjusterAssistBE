const express = require("express");
const cors = require("cors");
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const draftRoutes = require('./routes/draft.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const fileRoutes = require('./routes/file.routes');
const notificationsRoutes = require('./routes/notifications.routes')

const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("../swagger.json");
const { sendPushNotification } = require("./utils/notificationHelper");
const supabase = require("./config/supabase");

const app = express();

// add this line
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customSiteTitle: "Adjuster Assist API Docs",
  })
);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

app.get("/", (req, res) => {
  res.send("AdjusterAssist API running");
});


app.post('/api/notifications/test-send', async (req, res) => {
  const { userId } = req.body;
  console.log("Testing notification for User ID:", userId); // DEBUG 1

  try {
    // 1. Fetch the token for this user from your Supabase 'users' table
    const { data: user, error } = await supabase
      .from('users')
      .select('id, expo_push_token') // Select ID too for debugging
      .eq('id', userId)
      .single();
    console.log("Supabase Result:", user); // DEBUG 2
    console.log("Supabase Error:", error); // DEBUG 3

    if (error || !user?.expo_push_token) {
      return res.status(404).json({ error: "User token not found in database" });
    }

    // 2. Call our helper
    await sendPushNotification(
      user.expo_push_token,
      "AdjusterAssist Alert! 🔔",
      "This is a test notification from your Node.js backend."
    );

    res.json({ success: true, message: "Test notification sent!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Routes
app.use('/api/v1/auth', authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/drafts", draftRoutes);
app.use("/api/v1/files", fileRoutes);
app.use("/api/v1", require('./services/speechToText')); 
app.use("/api/v1/notifications", notificationsRoutes);

module.exports = app;
