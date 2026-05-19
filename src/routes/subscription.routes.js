const express = require("express");
const router = express.Router();
const { getMySubscription, upgradeSubscription, createSubscriptionOrder, verifySubscriptionPayment, getDetailedUsageHistory } = require("../controllers/subsription.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.get("/", async(req, res)=>{
    res.status(200).json({message:"Subscription Routes Success"})
});

router.get("/my-plan", authMiddleware, getMySubscription);
router.post("/upgrade", authMiddleware, upgradeSubscription);
router.get("/history", authMiddleware, getDetailedUsageHistory);

router.post(
  "/create-order",
  authMiddleware,
  createSubscriptionOrder
);

router.post(
  "/verify-payment",
  authMiddleware,
  verifySubscriptionPayment
);

module.exports = router;