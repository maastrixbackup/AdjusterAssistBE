const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');

// This matches the path: /api/notifications/save-token
router.post('/save-token', notificationController.saveToken );

module.exports = router;