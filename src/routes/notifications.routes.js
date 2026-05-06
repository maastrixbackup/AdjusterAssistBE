const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/save-token', authMiddleware,  notificationController.saveToken );
router.post('/test-send', authMiddleware, notificationController.sendTestNotification );

module.exports = router;