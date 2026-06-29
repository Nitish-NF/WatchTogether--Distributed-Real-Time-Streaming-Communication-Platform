const router = require('express').Router();
const { protect } = require('../../middleware/auth.middleware.js');
const { createRoom, getRoom, getPublic, getMyParties, closeRoom, toggleLock, saveSyncState } = require('./party.controller');

router.post('/create',          protect, createRoom);
router.get('/public',                    getPublic);
router.get('/mine',             protect, getMyParties);
router.get('/:roomId',          protect, getRoom);
router.patch('/:roomId/close',  protect, closeRoom);
router.patch('/:roomId/lock',   protect, toggleLock);
router.patch('/:roomId/sync',   protect, saveSyncState)
module.exports = router;