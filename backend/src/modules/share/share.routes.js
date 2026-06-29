const router = require('express').Router();
const { protect } = require('../../middleware/auth.middleware.js');
const { shareMovie, shareParty, getFeed,getRequests,declineRequest,acceptRequest} = require('./share.controller.js');

router.post('/movie',  protect, shareMovie);
router.post('/party',  protect, shareParty);
router.get('/feed',    protect, getFeed);
router.get('/requests', protect, getRequests);
router.patch( '/requests/:shareId/accept',  protect, acceptRequest);
router.delete('/requests/:shareId', protect, declineRequest);

module.exports = router;
