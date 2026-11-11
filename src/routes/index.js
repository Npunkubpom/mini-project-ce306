'use strict';
// รวมทุก route ไว้ใต้ /api/v1
const express = require('express');
const { apiNotFound } = require('../middlewares/errorHandler');

const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/exercises', require('./exercise.routes'));
router.use('/workouts', require('./workout.routes'));
router.use('/stats', require('./stats.routes'));
router.use('/body-metrics', require('./bodyMetric.routes'));
router.use('/admin', require('./admin.routes'));

router.use(apiNotFound);

module.exports = router;
