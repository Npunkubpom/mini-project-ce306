'use strict';
// สร้างข้อมูลตัวอย่างสำหรับสาธิต (Demo): ผู้ใช้ 2 บัญชี + ประวัติการเล่น 6 สัปดาห์
// รัน:  npm run seed:demo   (รันซ้ำได้ ข้อมูลของบัญชี demo จะถูกสร้างใหม่ทุกครั้ง)
//
//   demo@gymlog.app   / demo1234   (USER)
//   admin@gymlog.app  / admin1234  (ADMIN)

require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// โปรแกรม 3 วัน/สัปดาห์: [ชื่อท่า, น้ำหนักเริ่ม (kg), เพิ่มต่อสัปดาห์ (kg), reps]
const PLAN = {
  Push: [
    ['Barbell Bench Press', 50, 2.5, 8],
    ['Incline Dumbbell Press', 16, 1, 10],
    ['Overhead Press', 30, 1.25, 8],
    ['Triceps Pushdown', 20, 1.25, 12],
  ],
  Pull: [
    ['Deadlift', 80, 5, 5],
    ['Lat Pulldown', 40, 2.5, 10],
    ['Seated Cable Row', 40, 2.5, 10],
    ['Barbell Curl', 20, 1.25, 10],
  ],
  Legs: [
    ['Barbell Squat', 60, 5, 6],
    ['Leg Press', 100, 10, 10],
    ['Leg Curl', 30, 2.5, 12],
    ['Plank', 0, 0, 60],
  ],
};
const DAYS = [
  [1, 'Push'], // จันทร์
  [3, 'Pull'], // พุธ
  [5, 'Legs'], // ศุกร์
];
const NOTES = ['นอนน้อย แรงตก', 'วันนี้ฟอร์มดี', 'ยิมคนเยอะ รอเครื่องนาน', null, null, null];

const ymd = (d) => d.toISOString().slice(0, 10);

async function upsertUser(client, email, name, password, role) {
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
     RETURNING id`,
    [email, hash, name, role]
  );
  return rows[0].id;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const demoId = await upsertUser(client, 'demo@gymlog.app', 'Demo User', 'demo1234', 'USER');
    await upsertUser(client, 'admin@gymlog.app', 'Gym Admin', 'admin1234', 'ADMIN');

    await client.query('DELETE FROM workout_sessions WHERE user_id = $1', [demoId]);
    await client.query('DELETE FROM exercises WHERE created_by = $1', [demoId]);
    await client.query(
      `INSERT INTO exercises (name, category, equipment_type, created_by)
       VALUES ('Hip Thrust (Smith)', 'Legs', 'Machine', $1)`,
      [demoId]
    );

    const { rows: exRows } = await client.query('SELECT id, name FROM exercises WHERE created_by IS NULL');
    const exId = Object.fromEntries(exRows.map((r) => [r.name, r.id]));

    // หาวันจันทร์ของ 6 สัปดาห์ก่อน (ไม่รวมสัปดาห์นี้)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7) - 7 * 6);

    let n = 0;
    for (let week = 0; week < 6; week++) {
      for (const [weekday, dayName] of DAYS) {
        const date = new Date(monday);
        date.setUTCDate(monday.getUTCDate() + week * 7 + (weekday - 1));
        if (date >= today) continue;
        if (week === 3 && dayName === 'Pull') continue; // ขาดไป 1 วัน ให้ดูสมจริง

        const notes = NOTES[n++ % NOTES.length];
        const { rows } = await client.query(
          'INSERT INTO workout_sessions (user_id, workout_date, notes) VALUES ($1, $2, $3) RETURNING id',
          [demoId, ymd(date), notes ? `${dayName} day — ${notes}` : `${dayName} day`]
        );
        const sessionId = rows[0].id;

        for (const [name, start, step, reps] of PLAN[dayName]) {
          const weight = start + step * week;
          for (let set = 1; set <= 3; set++) {
            const r = set === 3 && week % 2 === 1 ? reps - 2 : reps; // เซตสุดท้ายบางสัปดาห์ทำไม่ครบ
            await client.query(
              `INSERT INTO workout_sets (session_id, exercise_id, set_number, weight_kg, reps, is_completed)
               VALUES ($1, $2, $3, $4, $5, true)`,
              [sessionId, exId[name], set, weight, r]
            );
          }
        }
      }
    }
    // ค่าร่างกายสัปดาห์ละครั้ง (เช้าวันจันทร์): ไขมันลดลง กล้ามเนื้อเพิ่มขึ้นเล็กน้อย
    await client.query('DELETE FROM body_metrics WHERE user_id = $1', [demoId]);
    for (let week = 0; week < 6; week++) {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + week * 7);
      if (date > today) continue;
      await client.query(
        `INSERT INTO body_metrics (user_id, measured_on, weight_kg, body_fat_pct, muscle_mass_kg)
         VALUES ($1, $2, $3, $4, $5)`,
        [demoId, ymd(date), 72.4 - week * 0.3 + (week % 2) * 0.2, 22.1 - week * 0.5, 31.0 + week * 0.25]
      );
    }

    await client.query('COMMIT');
    console.log(`สร้างข้อมูลตัวอย่างแล้ว: ${n} sessions`);
    console.log('  demo@gymlog.app  / demo1234   (USER)');
    console.log('  admin@gymlog.app / admin1234  (ADMIN)');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
