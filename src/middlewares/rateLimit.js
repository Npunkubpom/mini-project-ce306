'use strict';
// จำกัดจำนวนครั้งที่สมัคร/ล็อกอิน กันการเดารหัสผ่าน (50 ครั้ง / 15 นาที / IP)
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'คำขอมากเกินไป กรุณาลองใหม่ภายหลัง' },
});

module.exports = { authLimiter };
