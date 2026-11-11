'use strict';
// /api/v1/stats  (ภาพรวม, PR, ข้อมูลกราฟ)
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const stats = require('../controllers/stats.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/summary', asyncHandler(stats.summary));
router.get('/prs', asyncHandler(stats.personalRecords));
router.get('/progress/:exercise_id', asyncHandler(stats.progress));

module.exports = router;
