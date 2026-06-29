const notificationService = require('./notification.service.js');
const { asyncHandler, sendSuccess } = require('../../utils/helpers.js');

const getNotifications = asyncHandler(async (req, res) => {
  const data = await notificationService.getForUser(req.user._id);
  sendSuccess(res, data);
});

const markRead = asyncHandler(async (req, res) => {
  const notif = await notificationService.markRead(req.params.id, req.user._id);
  sendSuccess(res, notif);
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user._id);
  sendSuccess(res, { updated: true });
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user._id);
  sendSuccess(res, { count });
});

module.exports = { getNotifications, markRead, markAllRead, getUnreadCount };