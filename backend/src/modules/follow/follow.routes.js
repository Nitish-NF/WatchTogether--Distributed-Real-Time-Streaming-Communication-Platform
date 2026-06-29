const router = require('express').Router();
const { protect } = require('../../middleware/auth.middleware.js');
const c = require('./follow.controller.js');

router.post('/request/:targetId',      protect, c.sendRequest);
router.post('/accept/:requesterId',    protect, c.acceptRequest);
router.delete('/reject/:requesterId',  protect, c.rejectRequest);
router.delete('/request/:targetId',    protect, c.cancelRequest);
router.delete('/:targetId',            protect, c.unfollow);
router.get('/status/:targetId',        protect, c.getStatus);
router.get('/followers/:userId',       protect, c.getFollowers);
router.get('/following/:userId',       protect, c.getFollowing);

module.exports = router;