const express = require("express");
const router = express.Router();
const { getMySubscription, upgradeSubscription } = require("../controllers/subsription.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.get("/", async(req, res)=>{
    res.status(200).json({message:"Subscription Routes Success"})
});

router.get("/my-plan", authMiddleware, getMySubscription);
router.post("/upgrade", authMiddleware, upgradeSubscription);

module.exports = router;