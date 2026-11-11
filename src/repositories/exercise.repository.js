'use strict';
// SQL ของตาราง exercises
// ownerId = id ผู้ใช้ (ท่าส่วนตัว) หรือ null (ท่ากลาง)
const pool = require('../config/db');

const COLUMNS = 'id, name, category, equipment_type, (created_by IS NOT NULL) AS is_custom';

// ท่ากลาง + ท่าส่วนตัวของผู้ใช้คนนี้
async function listVisibleTo(userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM exercises
      WHERE created_by IS NULL OR created_by = $1
      ORDER BY category, name`,
    [userId]
  );
  return rows;
}

// ท่ากลางทั้งหมด + จำนวนเซตที่ถูกใช้ (หน้า Admin)
async function listGlobalWithUsage() {
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.category, e.equipment_type, false AS is_custom,
            COUNT(s.id)::int AS usage_count
       FROM exercises e
       LEFT JOIN workout_sets s ON s.exercise_id = e.id
      WHERE e.created_by IS NULL
      GROUP BY e.id
      ORDER BY e.category, e.name`
  );
  return rows;
}

// มีชื่อนี้ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) ในท่ากลาง หรือท่าของ owner อยู่แล้วหรือไม่
async function nameExists(name, ownerId, excludeId) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM exercises
      WHERE lower(name) = lower($1)
        AND (created_by IS NULL OR created_by = $2)
        AND ($3::int IS NULL OR id <> $3::int)`,
    [name, ownerId, excludeId]
  );
  return rowCount > 0;
}

// ผู้ใช้คนนี้ใช้ท่านี้ได้ไหม (ท่ากลาง หรือท่าของตัวเอง)
async function isUsableBy(id, userId) {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM exercises WHERE id = $1 AND (created_by IS NULL OR created_by = $2)',
    [id, userId]
  );
  return rowCount > 0;
}

async function isUsedInSets(id) {
  const { rowCount } = await pool.query('SELECT 1 FROM workout_sets WHERE exercise_id = $1 LIMIT 1', [id]);
  return rowCount > 0;
}

async function create({ name, category, equipment_type }, ownerId) {
  const { rows } = await pool.query(
    `INSERT INTO exercises (name, category, equipment_type, created_by)
     VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
    [name, category, equipment_type, ownerId]
  );
  return rows[0];
}

// data = เฉพาะคอลัมน์ที่จะแก้ (ชื่อคอลัมน์ผ่านการตรวจใน service แล้ว)
async function update(id, data, ownerId) {
  const cols = Object.keys(data);
  const values = cols.map((c) => data[c]);
  values.push(id, ownerId);
  const { rows } = await pool.query(
    `UPDATE exercises SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}
      WHERE id = $${values.length - 1} AND created_by IS NOT DISTINCT FROM $${values.length}
      RETURNING ${COLUMNS}`,
    values
  );
  return rows[0] || null;
}

async function remove(id, ownerId) {
  const { rowCount } = await pool.query(
    'DELETE FROM exercises WHERE id = $1 AND created_by IS NOT DISTINCT FROM $2',
    [id, ownerId]
  );
  return rowCount > 0;
}

module.exports = {
  listVisibleTo,
  listGlobalWithUsage,
  nameExists,
  isUsableBy,
  isUsedInSets,
  create,
  update,
  remove,
};
