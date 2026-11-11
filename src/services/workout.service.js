'use strict';
// การเข้ายิม (session) และเซต: ตรวจข้อมูล + ตรวจความเป็นเจ้าของ
const HttpError = require('../utils/HttpError');
const { toInt, toNum, isDateStr } = require('../utils/validators');
const sessionRepo = require('../repositories/session.repository');
const setRepo = require('../repositories/set.repository');
const exerciseRepo = require('../repositories/exercise.repository');

/* ----------------------------- Sessions ----------------------------- */

// session ของวันนั้น (ถ้ามี) พร้อมเซตทั้งหมด
async function getDay(userId, date) {
  if (!isDateStr(date)) throw new HttpError(400, 'ต้องระบุ date ในรูปแบบ YYYY-MM-DD');
  const session = await sessionRepo.findByDate(userId, date);
  if (!session) return { session: null, sets: [] };
  return { session, sets: await setRepo.listBySession(session.id, 'id') };
}

async function createSession(userId, body) {
  let date = null;
  if (body.workout_date !== undefined && body.workout_date !== null) {
    if (!isDateStr(body.workout_date)) throw new HttpError(400, 'workout_date ต้องเป็น YYYY-MM-DD');
    date = body.workout_date;
  }
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null;
  return sessionRepo.create(userId, date, notes);
}

async function listSessions(userId, query) {
  const limit = Math.min(Math.max(toInt(query.limit) || 10, 1), 50);
  const offset = Math.max(toInt(query.offset) || 0, 0);
  const rows = await sessionRepo.listWithSummary(userId, limit + 1, offset); // ดึงเกิน 1 แถวไว้รู้ว่ายังมีต่อไหม
  return { sessions: rows.slice(0, limit), has_more: rows.length > limit };
}

// ไม่ใช่ของตัวเอง = 404 เหมือนไม่มีอยู่ (ไม่บอกว่ามี id นี้ในระบบ)
async function getSession(userId, id) {
  const session = await sessionRepo.findOwned(id, userId);
  if (!session) throw new HttpError(404, 'ไม่พบ session นี้');
  return { session, sets: await setRepo.listBySession(session.id, 'exercise') };
}

async function updateNotes(userId, id, body) {
  if (!('notes' in body) || (body.notes !== null && typeof body.notes !== 'string')) {
    throw new HttpError(400, 'notes ต้องเป็นข้อความ');
  }
  const notes = body.notes === null ? null : body.notes.trim().slice(0, 2000) || null;
  const session = await sessionRepo.updateNotes(id, userId, notes);
  if (!session) throw new HttpError(404, 'ไม่พบ session นี้');
  return session;
}

async function deleteSession(userId, id) {
  if (!(await sessionRepo.remove(id, userId))) throw new HttpError(404, 'ไม่พบ session นี้');
}

/* -------------------------- History / Sets -------------------------- */

// ประวัติ "ครั้งล่าสุด" ที่เล่นท่านี้ครบแล้ว (เฉพาะเซตที่ is_completed)
async function getLastHistory(userId, exerciseId, excludeRaw) {
  const exclude = excludeRaw !== undefined ? toInt(excludeRaw) : null;
  if (excludeRaw !== undefined && exclude === null) throw new HttpError(400, 'exclude_session_id ไม่ถูกต้อง');

  const rows = await setRepo.lastCompletedForExercise(userId, exerciseId, exclude);
  return {
    exercise_id: exerciseId,
    workout_date: rows.length ? rows[0].workout_date : null,
    sets: rows.map(({ set_number, weight_kg, reps }) => ({ set_number, weight_kg, reps })),
  };
}

const checkSetNumber = (n) => {
  if (n === null || n < 1 || n > 100) throw new HttpError(400, 'set_number ต้องเป็นจำนวนเต็ม 1-100');
};
const checkWeight = (w) => {
  if (w === null || w < 0 || w > 1000) throw new HttpError(400, 'weight_kg ต้องอยู่ระหว่าง 0-1000');
};
const checkReps = (r) => {
  if (r === null || r < 1 || r > 1000) throw new HttpError(400, 'reps ต้องเป็นจำนวนเต็ม 1-1000');
};
const checkCompleted = (v) => {
  if (typeof v !== 'boolean') throw new HttpError(400, 'is_completed ต้องเป็น true/false');
};

async function addSet(userId, body) {
  const sessionId = toInt(body.session_id);
  const exerciseId = toInt(body.exercise_id);
  const setNumber = toInt(body.set_number);
  const weight = toNum(body.weight_kg);
  const reps = toInt(body.reps);
  const isCompleted = body.is_completed === undefined ? false : body.is_completed;

  if (sessionId === null) throw new HttpError(400, 'session_id ไม่ถูกต้อง');
  if (exerciseId === null) throw new HttpError(400, 'exercise_id ไม่ถูกต้อง');
  checkSetNumber(setNumber);
  checkWeight(weight);
  checkReps(reps);
  checkCompleted(isCompleted);

  // ต้องเป็น session ของผู้ใช้คนนี้ และเป็นท่ากลางหรือท่าของตัวเองเท่านั้น
  if (!(await sessionRepo.isOwned(sessionId, userId))) throw new HttpError(404, 'ไม่พบ session นี้');
  if (!(await exerciseRepo.isUsableBy(exerciseId, userId))) throw new HttpError(404, 'ไม่พบท่านี้');

  return setRepo.create({ sessionId, exerciseId, setNumber, weight, reps, isCompleted });
}

async function updateSet(userId, id, body) {
  const data = {};
  if ('weight_kg' in body) {
    const w = toNum(body.weight_kg);
    checkWeight(w);
    data.weight_kg = w;
  }
  if ('reps' in body) {
    const r = toInt(body.reps);
    checkReps(r);
    data.reps = r;
  }
  if ('set_number' in body) {
    const n = toInt(body.set_number);
    checkSetNumber(n);
    data.set_number = n;
  }
  if ('is_completed' in body) {
    checkCompleted(body.is_completed);
    data.is_completed = body.is_completed;
  }
  if (!Object.keys(data).length) throw new HttpError(400, 'ไม่มีข้อมูลที่ต้องการอัปเดต');

  const set = await setRepo.updateOwned(id, userId, data);
  if (!set) throw new HttpError(404, 'ไม่พบเซตนี้');
  return set;
}

async function deleteSet(userId, id) {
  if (!(await setRepo.removeOwned(id, userId))) throw new HttpError(404, 'ไม่พบเซตนี้');
}

module.exports = {
  getDay,
  createSession,
  listSessions,
  getSession,
  updateNotes,
  deleteSession,
  getLastHistory,
  addSet,
  updateSet,
  deleteSet,
};
