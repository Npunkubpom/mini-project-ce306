'use strict';
// SQL ของตาราง workout_sessions (การเข้ายิม 1 ครั้ง)
// ทุก query กรองด้วย user_id -> ผู้ใช้เห็นเฉพาะของตัวเอง
const pool = require('../config/db');

const COLUMNS = 'id, workout_date::text AS workout_date, notes';

async function findOwned(id, userId) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM workout_sessions WHERE id = $1 AND user_id = $2`, [
    id,
    userId,
  ]);
  return rows[0] || null;
}

async function isOwned(id, userId) {
  const { rowCount } = await pool.query('SELECT 1 FROM workout_sessions WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
}

// session ล่าสุดของวันนั้น (ถ้ามี)
async function findByDate(userId, date) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS}
       FROM workout_sessions
      WHERE user_id = $1 AND workout_date = $2
      ORDER BY id DESC LIMIT 1`,
    [userId, date]
  );
  return rows[0] || null;
}

async function create(userId, date, notes) {
  const { rows } = await pool.query(
    `INSERT INTO workout_sessions (user_id, workout_date, notes)
     VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3)
     RETURNING ${COLUMNS}`,
    [userId, date, notes]
  );
  return rows[0];
}

// รายการย้อนหลังพร้อมสรุปต่อวัน (ข้าม session ว่างที่ไม่มีเซตและโน้ต)
async function listWithSummary(userId, limit, offset) {
  const { rows } = await pool.query(
    `SELECT ws.id, ws.workout_date::text AS workout_date, ws.notes,
            COUNT(s.id)::int                                   AS set_count,
            COUNT(s.id) FILTER (WHERE s.is_completed)::int     AS completed_count,
            COALESCE(SUM(s.reps), 0)::int                      AS total_reps,
            COALESCE(SUM(s.weight_kg * s.reps), 0)             AS volume,
            COALESCE(ARRAY_AGG(DISTINCT e.name) FILTER (WHERE e.name IS NOT NULL), '{}') AS exercises
       FROM workout_sessions ws
       LEFT JOIN workout_sets s ON s.session_id = ws.id
       LEFT JOIN exercises e    ON e.id = s.exercise_id
      WHERE ws.user_id = $1
      GROUP BY ws.id
     HAVING COUNT(s.id) > 0 OR ws.notes IS NOT NULL
      ORDER BY ws.workout_date DESC, ws.id DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

async function updateNotes(id, userId, notes) {
  const { rows } = await pool.query(
    `UPDATE workout_sessions SET notes = $1 WHERE id = $2 AND user_id = $3
     RETURNING ${COLUMNS}`,
    [notes, id, userId]
  );
  return rows[0] || null;
}

// เซตในวันนั้นถูกลบตามด้วย ON DELETE CASCADE
async function remove(id, userId) {
  const { rowCount } = await pool.query('DELETE FROM workout_sessions WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
}

module.exports = { findOwned, isOwned, findByDate, create, listWithSummary, updateNotes, remove };
