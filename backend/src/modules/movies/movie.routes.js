const router = require('express').Router();
const { protect } = require('../../middleware/auth.middleware.js');
const c = require('./movie.controller.js');

router.get('/trending',                 c.getTrending);
router.get('/new',               protect, c.getNew);
router.get('/by-genre',          protect, c.getByGenre);
router.get('/continue-watching', protect, c.getContinueWatching);
router.get('/search',            protect, c.search);
router.get('/:id',               protect, c.getById);
router.post('/',                 protect, c.createMovie);    // admin use
router.patch('/:id',             protect, c.updateMovie);   // admin use
router.delete('/:id',            protect, c.deleteMovie);   // admin use

module.exports = router;