const express = require("express");
const router = express.Router();

// Import your auh controller
const { login, signup } = require("../controllers/auth.controller");

router.post("/signup", signup);
router.post("/login", login);

module.exports = router;