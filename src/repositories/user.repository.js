'use strict';
// SQL ของตาราง users เท่านั้น (ไม่มีกฎทางธุรกิจ)
const pool = require('../config/db');

const PUBLIC_COLUMNS = 'id, email, name, role, rest_seconds';

async function create({ email, passwordHash, name }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'USER')
     RETURNING ${PUBLIC_COLUMNS}, created_at`,
    [email, passwordHash, name]
  );
  return rows[0];
}

async function findByEmailWithPassword(email) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findRoleById(id) {
  const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
  return rows[0] ? rows[0].role : null;
}

async function updateRestSeconds(id, seconds) {
  const { rows } = await pool.query(
    `UPDATE users SET rest_seconds = $1 WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [seconds, id]
  );
  return rows[0] || null;
}

async function updateRole(id, role) {
  const { rows } = await pool.query(
    'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role',
    [role, id]
  );
  return rows[0] || null;
}

// รายชื่อผู้ใช้ + จำนวนครั้งที่เข้ายิม (หน้า Admin)
async function listWithActivity(q) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.role, u.created_at,
            COUNT(ws.id)::int            AS session_count,
            MAX(ws.workout_date)::text   AS last_workout
       FROM users u
       LEFT JOIN workout_sessions ws ON ws.user_id = u.id
      WHERE $1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.name ILIKE '%' || $1 || '%'
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 200`,
    [q]
  );
  return rows;
}

module.exports = {
  create,
  findByEmailWithPassword,
  findById,
  findRoleById,
  updateRestSeconds,
  updateRole,
  listWithActivity,
};
