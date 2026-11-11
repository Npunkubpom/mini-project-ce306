'use strict';
// งานของผู้ดูแลระบบ: สถิติระบบ, จัดการผู้ใช้, จัดการท่ากลาง
const HttpError = require('../utils/HttpError');
const adminRepo = require('../repositories/admin.repository');
const userRepo = require('../repositories/user.repository');
const exerciseService = require('./exercise.service');

const TOP_EXERCISES = 5;

async function getStats() {
  const [totals, top] = await Promise.all([adminRepo.systemTotals(), adminRepo.topExercises(TOP_EXERCISES)]);
  return { totals, top_exercises: top };
}

function listUsers(query) {
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  return userRepo.listWithActivity(q);
}

// เปลี่ยน role ของตัวเองไม่ได้ กันล็อกตัวเองออกจากระบบ
async function changeRole(adminId, userId, role) {
  if (role !== 'USER' && role !== 'ADMIN') throw new HttpError(400, 'role ต้องเป็น USER หรือ ADMIN');
  if (userId === adminId) throw new HttpError(400, 'เปลี่ยน role ของตัวเองไม่ได้');
  const user = await userRepo.updateRole(userId, role);
  if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้');
  return user;
}

// ท่ากลาง = ท่าที่ไม่มีเจ้าของ (ownerId = null) ใช้กฎเดียวกับท่าของผู้ใช้
const listGlobalExercises = () => exerciseService.listGlobal();
const createGlobalExercise = (body) => exerciseService.create(body, null);
const updateGlobalExercise = (id, body) => exerciseService.update(id, body, null);
const deleteGlobalExercise = (id) => exerciseService.remove(id, null);

module.exports = {
  getStats,
  listUsers,
  changeRole,
  listGlobalExercises,
  createGlobalExercise,
  updateGlobalExercise,
  deleteGlobalExercise,
};
