'use strict';
// รับ request -> เรียก service -> ส่ง response (จัดการ cookie ที่นี่)
const env = require('../config/env');
const HttpError = require('../utils/HttpError');
const authService = require('../services/auth.service');

async function register(req, res) {
  const user = await authService.register(req.body || {});
  res.status(201).json({ user });
}

async function login(req, res) {
  const { user, token } = await authService.login(req.body || {});
  res.cookie(env.COOKIE_NAME, token, { ...env.cookieOptions, maxAge: env.COOKIE_MAX_AGE_MS });
  res.json({ user });
}

async function me(req, res) {
  const user = await authService.getUser(req.user.id);
  if (!user) {
    res.clearCookie(env.COOKIE_NAME, env.cookieOptions);
    throw new HttpError(401, 'ไม่พบบัญชีผู้ใช้');
  }
  res.json({ user });
}

async function updateMe(req, res) {
  res.json({ user: await authService.updateSettings(req.user.id, req.body || {}) });
}

function logout(req, res) {
  res.clearCookie(env.COOKIE_NAME, env.cookieOptions);
  res.json({ ok: true });
}

module.exports = { register, login, me, updateMe, logout };
