'use strict';
// อ่านค่าจาก .env ครั้งเดียว และตรวจว่าค่าที่จำเป็นมีครบก่อนเริ่มเซิร์ฟเวอร์
require('dotenv').config();

const env = {
  PORT: Number(process.env.PORT) || 3000,
  IS_PROD: process.env.NODE_ENV === 'production',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: '7d',
  COOKIE_NAME: 'gym_token',
  COOKIE_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  BCRYPT_ROUNDS: 12,
  CORS_ORIGINS: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

if (!env.DATABASE_URL) {
  console.error('ไม่พบ DATABASE_URL ในไฟล์ .env');
  process.exit(1);
}
if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET ต้องตั้งค่าใน .env และยาวอย่างน้อย 32 ตัวอักษร');
  process.exit(1);
}

// ค่าพื้นฐานของ cookie ที่เก็บ JWT
env.cookieOptions = {
  httpOnly: true, // JavaScript ฝั่งเบราว์เซอร์อ่านไม่ได้ -> กัน XSS ขโมย token
  sameSite: 'lax', // ช่วยกัน CSRF
  secure: env.IS_PROD, // production ต้องใช้ HTTPS
  path: '/',
};

module.exports = env;
