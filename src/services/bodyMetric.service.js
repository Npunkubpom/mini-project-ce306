'use strict';
// ค่าร่างกาย: น้ำหนักตัว / %ไขมัน / มวลกล้ามเนื้อ
const HttpError = require('../utils/HttpError');
const { toInt, toNum, isDateStr } = require('../utils/validators');
const bodyRepo = require('../repositories/bodyMetric.repository');

const FIELDS = {
  weight_kg: { min: 20, max: 300, label: 'น้ำหนักตัว' },
  body_fat_pct: { min: 2, max: 70, label: '%ไขมัน' },
  muscle_mass_kg: { min: 5, max: 150, label: 'มวลกล้ามเนื้อ' },
};

function list(userId, query) {
  const limit = Math.min(Math.max(toInt(query.limit) || 90, 1), 365);
  return bodyRepo.listByUser(userId, limit);
}

// ช่องที่ไม่ส่งมาหรือส่ง null = ไม่ได้วัดในวันนั้น แต่ต้องมีอย่างน้อย 1 ค่า
async function save(userId, body) {
  let date = null;
  if (body.measured_on !== undefined && body.measured_on !== null) {
    if (!isDateStr(body.measured_on)) throw new HttpError(400, 'measured_on ต้องเป็น YYYY-MM-DD');
    date = body.measured_on;
  }
  const values = {};
  for (const [field, { min, max, label }] of Object.entries(FIELDS)) {
    const raw = body[field];
    if (raw === undefined || raw === null || raw === '') {
      values[field] = null;
      continue;
    }
    const n = toNum(raw);
    if (n === null || n < min || n > max) throw new HttpError(400, `${label} ต้องอยู่ระหว่าง ${min}-${max}`);
    values[field] = n;
  }
  if (Object.values(values).every((v) => v === null)) {
    throw new HttpError(400, 'กรอกอย่างน้อย 1 ค่า (น้ำหนักตัว, %ไขมัน หรือมวลกล้ามเนื้อ)');
  }
  return bodyRepo.upsert(userId, date, values);
}

async function remove(userId, id) {
  if (!(await bodyRepo.removeOwned(id, userId))) throw new HttpError(404, 'ไม่พบข้อมูลนี้');
}

module.exports = { list, save, remove };
