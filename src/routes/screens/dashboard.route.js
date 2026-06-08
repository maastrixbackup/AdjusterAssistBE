
const express = require("express");
const router = express.Router();
const requireAAL2 = require("../../middlewares/requireAAL2");

const { getDashboardBootstrap } = require("../../controllers/screens/dashboard.controller.js");

const authMiddleware = require("../../middlewares/auth.middleware.js");

router.get("/dashboard/bootstrap", authMiddleware, requireAAL2, getDashboardBootstrap);

module.exports = router;