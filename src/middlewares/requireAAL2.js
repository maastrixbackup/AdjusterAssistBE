
const requireAAL2 = (req, res, next) => {
  const payload = req.jwtPayload;

  if (payload?.aal !== "aal2") {
    return res.status(403).json({
      success: false,
      code: "MFA_REQUIRED",
      message: "MFA verification is required.",
    });
  }

  next();
};

module.exports = requireAAL2;