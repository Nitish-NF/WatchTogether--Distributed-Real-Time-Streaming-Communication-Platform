const userService = require('./user.service.js');
const { asyncHandler, sendSuccess } = require('../../utils/helpers.js');

const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.params.userId);
  sendSuccess(res, user);
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user._id, req.body);
  sendSuccess(res, user);
});

const getHistory = asyncHandler(async (req, res) => {
  const history = await userService.getWatchHistory(req.params.userId);
  sendSuccess(res, history);
});

const saveProgress = asyncHandler(async (req, res) => {
  await userService.saveProgress(req.user._id, req.params.movieId, req.body.progress);
  sendSuccess(res, { saved: true });
});

const searchUsers = asyncHandler(async (req, res) => {
  const results = await userService.searchUsers(req.query.q || '', req.user._id);
  sendSuccess(res, results);
});

module.exports = { getProfile, updateMe, getHistory, saveProgress, searchUsers };