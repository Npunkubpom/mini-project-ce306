'use strict';
// /api/v1/admin  (ต้องล็อกอิน + เป็น ADMIN ทุกเส้นทาง)
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const admin = require('../controllers/admin.controller');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/stats', asyncHandler(admin.stats));

router.get('/users', asyncHandler(admin.listUsers));
router.patch('/users/:id', asyncHandler(admin.changeRole));

router.get('/exercises', asyncHandler(admin.listExercises));
router.post('/exercises', asyncHandler(admin.createExercise));
router.patch('/exercises/:id', asyncHandler(admin.updateExercise));
router.delete('/exercises/:id', asyncHandler(admin.deleteExercise));

module.exports = router;
