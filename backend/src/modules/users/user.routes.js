const router = require('express').Router();
const { protect } = require('../../middleware/auth.middleware.js');
const { getProfile, updateMe, getHistory, saveProgress, searchUsers } = require('./user.controller.js');

router.get('/search',               protect, searchUsers);
router.get('/me',                   protect, (req, res, next) => { req.params.userId = req.user._id.toString(); next(); }, getProfile);
router.patch('/me',                 protect, updateMe);
router.get('/:userId',              protect, getProfile);
router.get('/:userId/history',      protect, getHistory);
router.patch('/progress/:movieId',   protect, saveProgress);

module.exports = router;