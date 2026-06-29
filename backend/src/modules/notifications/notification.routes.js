const router = require('express').Router();
const { protect } = require('../../middleware/auth.middleware.js');
const { getNotifications, markRead, markAllRead, getUnreadCount } = require('./notification.controller.js');

router.get('/',              protect, getNotifications);
router.get('/unread-count',  protect, getUnreadCount);
router.patch('/read-all',    protect, markAllRead);
router.patch('/:id/read',    protect, markRead);

module.exports = router;