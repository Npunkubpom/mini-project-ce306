'use strict';
// /api/v1/exercises  (ท่ากลาง + ท่าของฉัน)
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const exercise = require('../controllers/exercise.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(exercise.list));
router.post('/', asyncHandler(exercise.create));
router.patch('/:id', asyncHandler(exercise.update));
router.delete('/:id', asyncHandler(exercise.remove));

module.exports = router;
