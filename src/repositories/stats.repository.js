'use strict';
// SQL สำหรับสถิติและกราฟของผู้ใช้ (นับเฉพาะเซตที่กด ✔ เล่นเสร็จแล้ว)
const pool = require('../config/db');

async function summary(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT ws.id)::int                                                AS sessions,
            COUNT(DISTINCT ws.id) FILTER (WHERE ws.workout_date >= CURRENT_DATE - 6)::int AS sessions_7d,
            COUNT(s.id)::int                                                          AS completed_sets,
            COALESCE(SUM(s.weight_kg * s.reps), 0)                                    AS volume
       FROM workout_sessions ws
       JOIN workout_sets s ON s.session_id = ws.id AND s.is_completed
      WHERE ws.user_id = $1`,
    [userId]
  );
  return rows[0];
}

// สถิติส่วนตัว (PR) = เซตที่หนักที่สุดของแต่ละท่า
async function personalRecords(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (s.exercise_id)
              s.exercise_id, e.name AS exercise_name, e.category,
              s.weight_kg, s.reps, ws.workout_date::text AS workout_date
         FROM workout_sets s
         JOIN workout_sessions ws ON ws.id = s.session_id
         JOIN exercises e         ON e.id = s.exercise_id
        WHERE ws.user_id = $1 AND s.is_completed
        ORDER BY s.exercise_id, s.weight_kg DESC, s.reps DESC, ws.workout_date
     ) pr
     ORDER BY weight_kg DESC, exercise_name`,
    [userId]
  );
  return rows;
}

// ข้อมูลกราฟของท่าเดียว ต่อวัน (ใหม่สุดก่อน, limit วัน)
async function progress(userId, exerciseId, limit) {
  const { rows } = await pool.query(
    `SELECT ws.workout_date::text                          AS workout_date,
            MAX(s.weight_kg)                               AS max_weight,
            ROUND(MAX(s.weight_kg * (1 + s.reps / 30.0)), 1) AS est_1rm,
            SUM(s.weight_kg * s.reps)                      AS volume,
            COUNT(*)::int                                  AS sets
       FROM workout_sets s
       JOIN workout_sessions ws ON ws.id = s.session_id
      WHERE ws.user_id = $1 AND s.exercise_id = $2 AND s.is_completed
      GROUP BY ws.workout_date
      ORDER BY ws.workout_date DESC
      LIMIT $3`,
    [userId, exerciseId, limit]
  );
  return rows;
}

module.exports = { summary, personalRecords, progress };
