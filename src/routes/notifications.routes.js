const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// This matches the path: /api/notifications/save-token
router.post('/save-token', authMiddleware,  notificationController.saveToken );

module.exports = router;