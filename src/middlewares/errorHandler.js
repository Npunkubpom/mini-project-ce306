'use strict';
// แปลง error ทุกชนิดเป็น JSON { error } พร้อม status code ที่เหมาะสม
const HttpError = require('../utils/HttpError');

// error code ของ PostgreSQL ที่เป็นความผิดของข้อมูลจาก client
const PG_ERRORS = {
  23505: [409, 'ข้อมูลซ้ำกับที่มีอยู่แล้ว'],
  23503: [400, 'ข้อมูลอ้างอิงไม่ถูกต้อง'],
  23514: [400, 'ข้อมูลไม่ผ่านเงื่อนไขของฐานข้อมูล'],
  22007: [400, 'รูปแบบวันที่ไม่ถูกต้อง'],
  22008: [400, 'รูปแบบวันที่ไม่ถูกต้อง'],
};

// path /api/* ที่ไม่มีอยู่จริง
function apiNotFound(req, res) {
  res.status(404).json({ error: 'ไม่พบ endpoint นี้' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'รูปแบบ JSON ไม่ถูกต้อง' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'ข้อมูลใหญ่เกินไป' });
  if (PG_ERRORS[err.code]) {
    const [status, message] = PG_ERRORS[err.code];
    return res.status(status).json({ error: message });
  }
  console.error(err);
  return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
}

module.exports = { apiNotFound, errorHandler };
