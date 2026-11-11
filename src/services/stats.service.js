'use strict';
// สถิติและข้อมูลกราฟของผู้ใช้
const statsRepo = require('../repositories/stats.repository');

const PROGRESS_POINTS = 30; // จำนวนครั้งล่าสุดที่แสดงในกราฟ

const getSummary = (userId) => statsRepo.summary(userId);
const getPersonalRecords = (userId) => statsRepo.personalRecords(userId);

async function getProgress(userId, exerciseId) {
  const rows = await statsRepo.progress(userId, exerciseId, PROGRESS_POINTS);
  return { exercise_id: exerciseId, points: rows.reverse() }; // เก่าสุดก่อน สำหรับวาดกราฟ
}

module.exports = { getSummary, getPersonalRecords, getProgress };
