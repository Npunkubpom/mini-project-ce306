'use strict';
// ฟังก์ชันช่วยแปลง / ตรวจรูปแบบข้อมูลที่รับมาจาก client
const HttpError = require('./HttpError');

// "12" -> 12, 12 -> 12, "abc" / 1.5 -> null
const toInt = (v) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) ? n : null;
};

// "60.5" -> 60.5, NaN / Infinity / "abc" -> null
const toNum = (v) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// แปลง path parameter เป็นจำนวนเต็ม ไม่ได้ -> 400
function parseId(value, label = 'id') {
  const id = toInt(value);
  if (id === null) throw new HttpError(400, `${label} ไม่ถูกต้อง`);
  return id;
}

module.exports = { toInt, toNum, isDateStr, EMAIL_RE, parseId };
