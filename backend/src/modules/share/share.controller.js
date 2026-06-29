const shareService = require('./share.service.js');
const { asyncHandler, sendSuccess } = require('../../utils/helpers.js');

const shareMovie = asyncHandler(async (req, res) => {
  const result = await shareService.shareMovie(req.user._id, req.body.movieId, req.body.userIds);
  sendSuccess(res, result, 201);
});

const shareParty = asyncHandler(async (req, res) => {
  const result = await shareService.shareParty(req.user._id, req.body.roomId, req.body.userIds);
  sendSuccess(res, result, 201);
});

const getFeed = asyncHandler(async (req, res) => {
  const feed = await shareService.getFeed(req.user._id);
  sendSuccess(res, feed);
});

const getRequests = asyncHandler(async (req, res) => {
   const data = await shareService.getRequests(req.user._id);
    sendSuccess(res, data);
});

const acceptRequest = asyncHandler(async (req, res) => {
  const data = await shareService.acceptRequest(req.user._id, req.params.shareId);
  sendSuccess(res, data);
});

const declineRequest = asyncHandler(async (req, res) => {
  await shareService.declineRequest(req.user._id, req.params.shareId);
  sendSuccess(res, { declined: true });
});

module.exports = { shareMovie, shareParty, getFeed,getRequests,acceptRequest,declineRequest };