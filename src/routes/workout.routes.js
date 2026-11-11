'use strict';
// /api/v1/workouts  (การเข้ายิม, เซต, ประวัติครั้งล่าสุด)
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const workout = require('../controllers/workout.controller');

const router = express.Router();
router.use(requireAuth);

// sessions (ต้องประกาศ /today ก่อน /:id ไม่งั้น "today" จะถูกมองเป็น id)
router.get('/sessions/today', asyncHandler(workout.getDay));
router.get('/sessions', asyncHandler(workout.listSessions));
router.post('/sessions', asyncHandler(workout.createSession));
router.get('/sessions/:id', asyncHandler(workout.getSession));
router.patch('/sessions/:id', asyncHandler(workout.updateSession));
router.delete('/sessions/:id', asyncHandler(workout.deleteSession));

// ประวัติครั้งล่าสุดของท่า
router.get('/history/:exercise_id', asyncHandler(workout.getHistory));

// sets
router.post('/sets', asyncHandler(workout.addSet));
router.patch('/sets/:id', asyncHandler(workout.updateSet));
router.delete('/sets/:id', asyncHandler(workout.deleteSet));

module.exports = router;
