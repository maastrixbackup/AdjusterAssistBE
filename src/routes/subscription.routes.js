const express = require("express");
const router = express.Router();
const { getMySubscription, upgradeSubscription } = require("../controllers/subsription.controller");
const authMiddleware = require("../middlewares/auth.middleware");

/**
 * @route   GET /api/subscriptions/my-plan
 * @desc    Get current user's subscription and usage details
 * @access  Private
 */
router.get("/my-plan", authMiddleware, getMySubscription);

/**
 * @route   POST /api/subscriptions/upgrade
 * @desc    Upgrade user to Gold or Diamond plan
 * @access  Private
 */
router.post("/upgrade", authMiddleware, upgradeSubscription);

module.exports = router;