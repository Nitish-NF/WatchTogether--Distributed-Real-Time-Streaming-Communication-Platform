const movieService = require('./movie.service.js');
const { asyncHandler, sendSuccess } = require('../../utils/helpers.js');

const getTrending        = asyncHandler(async (req, res) => sendSuccess(res, await movieService.getTrending()));
const getNew             = asyncHandler(async (req, res) => sendSuccess(res, await movieService.getNew()));
const getByGenre         = asyncHandler(async (req, res) => sendSuccess(res, await movieService.getByGenre()));
const getContinueWatching = asyncHandler(async (req, res) => sendSuccess(res, await movieService.getContinueWatching(req.user._id)));
const search             = asyncHandler(async (req, res) => sendSuccess(res, await movieService.search(req.query.q)));
const getById            = asyncHandler(async (req, res) => sendSuccess(res, await movieService.getById(req.user._id,req.params.id)));
const createMovie        = asyncHandler(async (req, res) => sendSuccess(res, await movieService.create(req.body), 201));
const updateMovie        = asyncHandler(async (req, res) => sendSuccess(res, await movieService.update(req.params.id, req.body)));
const deleteMovie        = asyncHandler(async (req, res) => { await movieService.delete(req.params.id); sendSuccess(res, { deleted: true }); });

module.exports = { getTrending, getNew, getByGenre, getContinueWatching, search, getById, createMovie, updateMovie, deleteMovie };