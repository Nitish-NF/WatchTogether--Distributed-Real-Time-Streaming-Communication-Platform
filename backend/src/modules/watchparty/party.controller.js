const partyService = require('./party.service.js');
const { asyncHandler, sendSuccess } = require('../../utils/helpers.js');

const createRoom     = asyncHandler(async (req, res) => sendSuccess(res, await partyService.createRoom(req.user._id, req.body.movieId,req.body), 201));
const getRoom        = asyncHandler(async (req, res) => sendSuccess(res, await partyService.getRoom(req.params.roomId)));
const getPublic      = asyncHandler(async (req, res) => sendSuccess(res, await partyService.getPublicRooms(req.query.movieId)));
const getMyParties   = asyncHandler(async (req, res) => sendSuccess(res, await partyService.getUserParties(req.user._id)));
const closeRoom      = asyncHandler(async (req, res) => sendSuccess(res, await partyService.closeRoom(req.params.roomId, req.user._id)));
const toggleLock     = asyncHandler(async (req, res) => sendSuccess(res, await partyService.toggleLock(req.params.roomId, req.user._id)));
const saveSyncState  = asyncHandler(async (req,res) => sendSuccess(res, await partyService.saveSyncState(req.params.roomId,req.body)))

module.exports = { createRoom, getRoom, getPublic, getMyParties, closeRoom, toggleLock,saveSyncState };