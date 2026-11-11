'use strict';
// กฎของท่าเล่น ใช้ร่วมกันระหว่าง "ท่าของฉัน" (ownerId = userId) กับ "ท่ากลาง" ของ Admin (ownerId = null)
const HttpError = require('../utils/HttpError');
const exerciseRepo = require('../repositories/exercise.repository');

const CATEGORIES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Other'];
const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Band', 'Other'];

// ตรวจข้อมูลท่าเล่น (partial = true ใช้กับ PATCH ที่ส่งมาบางช่อง)
function readExerciseBody(body, partial) {
  const out = {};
  if (!partial || 'name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (name.length < 2 || name.length > 100) throw new HttpError(400, 'ชื่อท่าต้องยาว 2-100 ตัวอักษร');
    out.name = name;
  }
  if (!partial || 'category' in body) {
    if (!CATEGORIES.includes(body.category)) throw new HttpError(400, 'หมวดหมู่ไม่ถูกต้อง');
    out.category = body.category;
  }
  if (!partial || 'equipment_type' in body) {
    const eq = body.equipment_type === undefined ? 'Other' : body.equipment_type;
    if (!EQUIPMENT.includes(eq)) throw new HttpError(400, 'ประเภทอุปกรณ์ไม่ถูกต้อง');
    out.equipment_type = eq;
  }
  if (partial && !Object.keys(out).length) throw new HttpError(400, 'ไม่มีข้อมูลที่ต้องการอัปเดต');
  return out;
}

// ชื่อท่าส่วนตัวต้องไม่ซ้ำท่ากลาง และท่ากลางใหม่ต้องไม่ซ้ำกับท่ากลางเดิม
async function assertNameFree(name, ownerId, excludeId) {
  if (await exerciseRepo.nameExists(name, ownerId, excludeId)) throw new HttpError(409, 'มีท่าชื่อนี้อยู่แล้ว');
}

async function listForUser(userId) {
  return { exercises: await exerciseRepo.listVisibleTo(userId), categories: CATEGORIES, equipment: EQUIPMENT };
}

async function listGlobal() {
  return { exercises: await exerciseRepo.listGlobalWithUsage(), categories: CATEGORIES, equipment: EQUIPMENT };
}

async function create(body, ownerId) {
  const data = readExerciseBody(body, false);
  await assertNameFree(data.name, ownerId, null);
  return exerciseRepo.create(data, ownerId);
}

async function update(id, body, ownerId) {
  const data = readExerciseBody(body, true);
  if (data.name) await assertNameFree(data.name, ownerId, id);
  const updated = await exerciseRepo.update(id, data, ownerId);
  if (!updated) throw new HttpError(404, 'ไม่พบท่านี้');
  return updated;
}

// ท่าที่มีประวัติการเล่นแล้วลบไม่ได้ (ประวัติของผู้ใช้จะหาย) แต่แก้ชื่อได้
async function remove(id, ownerId) {
  if (await exerciseRepo.isUsedInSets(id)) {
    throw new HttpError(409, 'ท่านี้มีประวัติการเล่นแล้ว จึงลบไม่ได้ (แก้ชื่อได้)');
  }
  if (!(await exerciseRepo.remove(id, ownerId))) throw new HttpError(404, 'ไม่พบท่านี้');
}

module.exports = { listForUser, listGlobal, create, update, remove };
