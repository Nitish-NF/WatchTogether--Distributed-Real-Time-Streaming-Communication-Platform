const followService = require('./follow.service.js');
const { asyncHandler, sendSuccess } = require('../../utils/helpers.js');

const sendRequest   = asyncHandler(async (req, res) => sendSuccess(res, await followService.sendRequest(req.user._id, req.params.targetId), 201));
const acceptRequest = asyncHandler(async (req, res) => sendSuccess(res, await followService.acceptRequest(req.user._id, req.params.requesterId)));
const rejectRequest = asyncHandler(async (req, res) => sendSuccess(res, await followService.rejectRequest(req.user._id, req.params.requesterId)));
const cancelRequest = asyncHandler(async (req, res) => sendSuccess(res, await followService.cancelRequest(req.user._id, req.params.targetId)));
const unfollow      = asyncHandler(async (req, res) => sendSuccess(res, await followService.unfollow(req.user._id, req.params.targetId)));
const getStatus     = asyncHandler(async (req, res) => sendSuccess(res, await followService.getStatus(req.user._id, req.params.targetId)));
const getFollowers  = asyncHandler(async (req, res) => sendSuccess(res, await followService.getFollowers(req.params.userId)));
const getFollowing  = asyncHandler(async (req, res) => sendSuccess(res, await followService.getFollowing(req.params.userId)));

module.exports = { sendRequest, acceptRequest, rejectRequest, cancelRequest, unfollow, getStatus, getFollowers, getFollowing };