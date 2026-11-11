'use strict';
// ตรวจการล็อกอิน (JWT ใน HTTP-Only cookie) และสิทธิ์ Admin
const env = require('../config/env');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

function requireAuth(req, res, next) {
  const token = req.cookies[env.COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  try {
    req.user = authService.verifyToken(token);
    return next();
  } catch {
    res.clearCookie(env.COOKIE_NAME, env.cookieOptions);
    return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' });
  }
}

// ใช้ต่อจาก requireAuth: ตรวจ role จากฐานข้อมูลทุกครั้ง (ไม่เชื่อ role ใน token อย่างเดียว
// เพราะถ้าถูกถอดสิทธิ์ token เก่ายังมี role ADMIN ค้างอยู่ได้ถึง 7 วัน)
const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!(await authService.isAdmin(req.user.id))) throw new HttpError(403, 'เฉพาะผู้ดูแลระบบเท่านั้น');
  next();
});

module.exports = { requireAuth, requireAdmin };
