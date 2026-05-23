const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many reset attempts, please try again after 15 minutes",
});
const {
  login,
  signup,
  forgotPassword,
  resetPassword,
  resendVerification,
  verifyCallback,
  refreshSession
} = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const requireAAL2 = require("../middlewares/requireAAL2");
const {
  getMFAStatus,
  enrollMFA,
  verifyMFAEnrollment,
  challengeMFA,
  verifyMFALogin,
  resetMFA,
  resetMFALogin,
  requestMFARecovery,
  recoveryCodeLogin
} = require("../services/auth/mfa.service");

router.post("/refresh", refreshSession);

// MFA
router.get("/mfa/status", authMiddleware, getMFAStatus);

// setup after signup
router.get("/mfa/test", async (req, res)=>{
   res.send("MFA API running");
})
router.get("/mfa/enroll", authMiddleware, enrollMFA);
router.post("/mfa/verify", authMiddleware, verifyMFAEnrollment);

// For login
router.post("/mfa/challenge", authMiddleware, challengeMFA);
router.post("/mfa/verify-login", authMiddleware, verifyMFALogin);

//Recovery 
router.post("/mfa/recovery-login", authMiddleware, recoveryCodeLogin);
router.post("/mfa/recovery-request", authMiddleware, requestMFARecovery);


// Reset
router.post("/mfa/reset-login", resetMFALogin);
router.post("/mfa/reset", authMiddleware, requireAAL2, resetMFA);

router.post("/signup", signup);
router.post("/login", resetLimiter, login);
router.post("/verify-callback", verifyCallback);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password", resetLimiter, forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/logout", authMiddleware, (req, res) => {
  res.status(200).json({ success: true, message: "Logout successful" });
});

module.exports = router;
