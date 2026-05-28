
const express = require("express");
const router = express.Router();
const {
  getDashboardBootstrap,
} = require("../../controllers/screens/dashboard.controller.js");

const authMiddleware = require("../../middlewares/auth.middleware.js");

router.get("/dashboard/bootstrap", authMiddleware, getDashboardBootstrap);

module.exports = router;