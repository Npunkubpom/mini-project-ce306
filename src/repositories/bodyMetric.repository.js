'use strict';
// SQL ของตาราง body_metrics (น้ำหนักตัว / %ไขมัน / มวลกล้ามเนื้อ วันละ 1 แถว)
const pool = require('../config/db');

const COLUMNS = 'id, measured_on::text AS measured_on, weight_kg, body_fat_pct, muscle_mass_kg';

async function listByUser(userId, limit) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM body_metrics
      WHERE user_id = $1 ORDER BY measured_on DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

// วันเดียวกันบันทึกซ้ำ = แทนค่าเดิมทั้งแถว (UNIQUE user_id + measured_on)
async function upsert(userId, date, { weight_kg, body_fat_pct, muscle_mass_kg }) {
  const { rows } = await pool.query(
    `INSERT INTO body_metrics (user_id, measured_on, weight_kg, body_fat_pct, muscle_mass_kg)
     VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5)
     ON CONFLICT (user_id, measured_on) DO UPDATE
       SET weight_kg = EXCLUDED.weight_kg,
           body_fat_pct = EXCLUDED.body_fat_pct,
           muscle_mass_kg = EXCLUDED.muscle_mass_kg
     RETURNING ${COLUMNS}`,
    [userId, date, weight_kg, body_fat_pct, muscle_mass_kg]
  );
  return rows[0];
}

async function removeOwned(id, userId) {
  const { rowCount } = await pool.query('DELETE FROM body_metrics WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
}

module.exports = { listByUser, upsert, removeOwned };
