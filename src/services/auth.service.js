'use strict';
// สมัคร / ล็อกอิน / JWT / ตั้งค่าส่วนตัว
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const HttpError = require('../utils/HttpError');
const { toInt, EMAIL_RE } = require('../utils/validators');
const userRepo = require('../repositories/user.repository');

// hash หลอกไว้เทียบเวลาเมื่อไม่พบอีเมล เพื่อลดการเดาว่าอีเมลไหนมีในระบบ
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', env.BCRYPT_ROUNDS);

const str = (v) => (typeof v === 'string' ? v : '');

async function register(body) {
  const email = str(body.email).trim().toLowerCase();
  const name = str(body.name).trim();
  const password = str(body.password);

  if (!EMAIL_RE.test(email) || email.length > 255) throw new HttpError(400, 'อีเมลไม่ถูกต้อง');
  if (name.length < 1 || name.length > 100) throw new HttpError(400, 'กรุณากรอกชื่อ (ไม่เกิน 100 ตัวอักษร)');
  if (password.length < 8) throw new HttpError(400, 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
  if (Buffer.byteLength(password, 'utf8') > 72) throw new HttpError(400, 'รหัสผ่านยาวเกินไป (สูงสุด 72 ไบต์)');

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  try {
    // role ถูกกำหนดเป็น USER เสมอใน repository ไม่รับค่าจาก client
    return await userRepo.create({ email, passwordHash, name });
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'อีเมลนี้ถูกใช้งานแล้ว');
    throw err;
  }
}

// คืน { user, token } ถ้าอีเมลและรหัสผ่านถูกต้อง
async function login(body) {
  const email = str(body.email).trim().toLowerCase();
  const password = str(body.password);
  if (!email || !password) throw new HttpError(400, 'กรุณากรอกอีเมลและรหัสผ่าน');

  const found = await userRepo.findByEmailWithPassword(email);
  const ok = await bcrypt.compare(password, found ? found.password_hash : DUMMY_HASH);
  if (!found || !ok) throw new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');

  const { password_hash: _omit, ...user } = found;
  return { user, token: signToken(user) };
}

function signToken(user) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// คืน { id, role } หรือ throw ถ้า token ปลอม/หมดอายุ
function verifyToken(token) {
  const payload = jwt.verify(token, env.JWT_SECRET);
  return { id: Number(payload.sub), role: payload.role };
}

function getUser(userId) {
  return userRepo.findById(userId);
}

async function updateSettings(userId, body) {
  const seconds = toInt(body.rest_seconds);
  if (seconds === null || seconds < 15 || seconds > 600) {
    throw new HttpError(400, 'rest_seconds ต้องเป็นจำนวนเต็ม 15-600');
  }
  return userRepo.updateRestSeconds(userId, seconds);
}

// ใช้ใน requireAdmin: ตรวจ role จากฐานข้อมูลทุกครั้ง
async function isAdmin(userId) {
  return (await userRepo.findRoleById(userId)) === 'ADMIN';
}

module.exports = { register, login, verifyToken, getUser, updateSettings, isAdmin };
