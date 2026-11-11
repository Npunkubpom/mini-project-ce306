'use strict';
// SQL ของตาราง workout_sets (แต่ละเซต)
// การแก้/ลบตรวจเจ้าของผ่าน session -> แก้เซตของคนอื่นไม่ได้
const pool = require('../config/db');

const COLUMNS = 'id, session_id, exercise_id, set_number, weight_kg, reps, is_completed';

// เซตทั้งหมดของ session พร้อมชื่อท่า; orderBy: 'id' (ตามลำดับที่บันทึก) | 'exercise' (จัดกลุ่มตามท่า)
async function listBySession(sessionId, orderBy = 'id') {
  const order = orderBy === 'exercise' ? 'e.name, ws.set_number, ws.id' : 'ws.id';
  const { rows } = await pool.query(
    `SELECT ws.id, ws.session_id, ws.exercise_id, e.name AS exercise_name,
            ws.set_number, ws.weight_kg, ws.reps, ws.is_completed
       FROM workout_sets ws
       JOIN exercises e ON e.id = ws.exercise_id
      WHERE ws.session_id = $1
      ORDER BY ${order}`,
    [sessionId]
  );
  return rows;
}

// เซตที่เล่นเสร็จของ "ครั้งล่าสุด" ที่เล่นท่านี้ (ข้าม excludeSessionId ได้)
async function lastCompletedForExercise(userId, exerciseId, excludeSessionId) {
  const { rows } = await pool.query(
    `WITH last_session AS (
       SELECT ws.id, ws.workout_date
         FROM workout_sessions ws
         JOIN workout_sets s ON s.session_id = ws.id
        WHERE ws.user_id = $1
          AND s.exercise_id = $2
          AND s.is_completed
          AND ($3::int IS NULL OR ws.id <> $3::int)
        ORDER BY ws.workout_date DESC, ws.id DESC
        LIMIT 1
     )
     SELECT l.workout_date::text AS workout_date, s.set_number, s.weight_kg, s.reps
       FROM last_session l
       JOIN workout_sets s ON s.session_id = l.id AND s.exercise_id = $2 AND s.is_completed
      ORDER BY s.set_number, s.id`,
    [userId, exerciseId, excludeSessionId]
  );
  return rows;
}

async function create({ sessionId, exerciseId, setNumber, weight, reps, isCompleted }) {
  const { rows } = await pool.query(
    `INSERT INTO workout_sets (session_id, exercise_id, set_number, weight_kg, reps, is_completed)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [sessionId, exerciseId, setNumber, weight, reps, isCompleted]
  );
  return rows[0];
}

// data = { column: value } เฉพาะคอลัมน์ที่จะแก้ (ชื่อคอลัมน์มาจาก service ไม่ใช่จาก client)
async function updateOwned(id, userId, data) {
  const cols = Object.keys(data);
  const values = cols.map((c) => data[c]);
  values.push(id, userId);
  const idPos = values.length - 1;
  const userPos = values.length;
  const { rows } = await pool.query(
    `UPDATE workout_sets
        SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}
      WHERE id = $${idPos}
        AND session_id IN (SELECT id FROM workout_sessions WHERE user_id = $${userPos})
      RETURNING ${COLUMNS}`,
    values
  );
  return rows[0] || null;
}

async function removeOwned(id, userId) {
  const { rowCount } = await pool.query(
    `DELETE FROM workout_sets
      WHERE id = $1
        AND session_id IN (SELECT id FROM workout_sessions WHERE user_id = $2)`,
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = { listBySession, lastCompletedForExercise, create, updateOwned, removeOwned };
