'use strict';
// SQL สถิติภาพรวมทั้งระบบ (เฉพาะหน้า Admin)
const pool = require('../config/db');

async function systemTotals() {
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM users)::int                                                AS users,
            (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days')::int  AS new_users_7d,
            (SELECT COUNT(DISTINCT user_id) FROM workout_sessions
              WHERE workout_date >= CURRENT_DATE - 6)::int                                   AS active_users_7d,
            (SELECT COUNT(*) FROM workout_sessions)::int                                     AS sessions,
            (SELECT COUNT(*) FROM workout_sets)::int                                         AS sets,
            (SELECT COUNT(*) FROM exercises WHERE created_by IS NULL)::int                   AS global_exercises,
            (SELECT COUNT(*) FROM exercises WHERE created_by IS NOT NULL)::int               AS custom_exercises`
  );
  return rows[0];
}

async function topExercises(limit) {
  const { rows } = await pool.query(
    `SELECT e.name, COUNT(*)::int AS set_count, COUNT(DISTINCT ws.user_id)::int AS user_count
       FROM workout_sets s
       JOIN exercises e         ON e.id = s.exercise_id
       JOIN workout_sessions ws ON ws.id = s.session_id
      GROUP BY e.id, e.name
      ORDER BY set_count DESC, e.name
      LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = { systemTotals, topExercises };
