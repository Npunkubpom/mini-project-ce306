'use strict';
// /api/v1/auth
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimit');
const auth = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', authLimiter, asyncHandler(auth.register));
router.post('/login', authLimiter, asyncHandler(auth.login));
router.post('/logout', auth.logout);
router.get('/me', requireAuth, asyncHandler(auth.me));
router.patch('/me', requireAuth, asyncHandler(auth.updateMe)); // ตั้งเวลาพัก

module.exports = router;
