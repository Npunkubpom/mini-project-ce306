'use strict';
// /api/v1/body-metrics  (น้ำหนักตัว / %ไขมัน / มวลกล้ามเนื้อ)
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const body = require('../controllers/bodyMetric.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(body.list));
router.post('/', asyncHandler(body.save));
router.delete('/:id', asyncHandler(body.remove));

module.exports = router;
