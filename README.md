# Gym Log Tracker 🏋️ (v2)

ระบบจดบันทึกน้ำหนักและท่าเล่นยิม พร้อมประวัติย้อนหลัง กราฟพัฒนาการ ค่าร่างกาย (%ไขมัน / มวลกล้ามเนื้อ) และหน้าผู้ดูแลระบบ
ใช้ได้ทั้งมือถือ (1 คอลัมน์) และจอคอม (2 คอลัมน์ ตั้งแต่ 1024px)
Express + PostgreSQL + Vanilla JS + Bootstrap 5 (Dark Mode, Mobile-First)

GitHub: `<ใส่ลิงก์ repo ของคุณ>`

## ฟีเจอร์

| หน้า | ฟีเจอร์ | ใครใช้ |
|---|---|---|
| วันนี้ | เลือกท่า → เห็นประวัติครั้งล่าสุด แตะเพื่อเติมค่า · เพิ่ม / แก้ / ลบเซต · กด ✔ แล้วแถวเขียว + ตัวจับเวลาพัก · สรุปวันนี้แบบเรียลไทม์ | USER |
| วันนี้ | **ใหม่** ตั้งเวลาพักเอง (30 วิ – 5 นาที บันทึกในบัญชี) · **ใหม่** โน้ตประจำวัน (บันทึกอัตโนมัติ) | USER |
| ประวัติ | **ใหม่** ภาพรวมทั้งหมด · กราฟพัฒนาการต่อท่า (น้ำหนักสูงสุด / 1RM ประมาณ / ปริมาณ) · สถิติส่วนตัว (PR) · รายการทุกวันที่เล่น เปิดดูเซต แก้โน้ต ลบทั้งวัน | USER |
| ท่าเล่น | **ใหม่** ค้นหาท่า · เพิ่ม / แก้ / ลบท่าของตัวเอง (เห็นเฉพาะตัวเอง ใช้บันทึกเซตได้ทันที) | USER |
| ร่างกาย | **ใหม่** บันทึกน้ำหนักตัว / %ไขมัน / มวลกล้ามเนื้อ (วันละ 1 ครั้ง กรอกเฉพาะค่าที่วัดได้) · ค่าล่าสุดเทียบครั้งก่อน · มวลไขมันคำนวณให้ · กราฟ · แก้ / ลบย้อนหลัง | USER |
| Admin | **ใหม่** สถิติทั้งระบบ · ท่ายอดนิยม · รายชื่อผู้ใช้ + ค้นหา + ตั้ง / ถอดสิทธิ์ Admin · จัดการท่ากลาง (CRUD) | ADMIN |

## โครงสร้างไฟล์

```
gym-log-tracker/
├── server.js               # จุดเริ่มต้น: เปิดเซิร์ฟเวอร์ + ปิดอย่างนุ่มนวล
├── schema.sql              # สร้าง/อัปเกรดตาราง + ท่าเริ่มต้น 25 ท่า (รันซ้ำได้)
├── scripts/seed-demo.js    # ข้อมูลตัวอย่างสำหรับสาธิต
├── src/
│   ├── app.js              # ประกอบ Express: Helmet, CORS, JSON, cookie, routes, static, error
│   ├── config/             # env.js (อ่าน .env), db.js (PostgreSQL pool)
│   ├── middlewares/        # auth.js (requireAuth, requireAdmin), rateLimit.js, errorHandler.js
│   ├── routes/             # URL + middleware -> controller
│   ├── controllers/        # อ่าน req, เรียก service, ส่ง res (status code, cookie)
│   ├── services/           # ตรวจข้อมูล + กฎทางธุรกิจ (ความเป็นเจ้าของ, ชื่อซ้ำ, สิทธิ์)
│   ├── repositories/       # SQL ล้วน คุยกับฐานข้อมูลที่เดียว
│   └── utils/              # HttpError, asyncHandler, validators
├── public/                 # หน้าเว็บ: index.html, styles.css, app.js
├── screenshots/            # ภาพผลการทำงานของระบบ
├── package.json
└── .env.example            # ตัวอย่างค่าตั้งค่า (คัดลอกเป็น .env)
```

### Backend แบ่งเป็นชั้น (Layered Architecture)

```
request → routes → controllers → services → repositories → PostgreSQL
```

| ชั้น | หน้าที่ | ห้ามทำ | ตัวอย่าง |
|---|---|---|---|
| routes | จับคู่ URL + method กับ controller, ใส่ middleware (ล็อกอิน, Admin, rate limit) | มี logic | `router.post('/sets', asyncHandler(workout.addSet))` |
| controllers | อ่าน `req.params / body / query / user`, ส่ง `res.status().json()`, จัดการ cookie | เขียน SQL | `res.status(201).json({ set })` |
| services | ตรวจข้อมูล, กฎทางธุรกิจ, throw `HttpError` | รู้จัก `req` / `res` | ต้องเป็น session ของตัวเอง, ท่าที่มีประวัติห้ามลบ |
| repositories | SQL แบบ parameterized เท่านั้น | ตัดสินใจทางธุรกิจ | `INSERT INTO workout_sets ...` |

แต่ละโดเมนมีไฟล์ครบทุกชั้น: `auth`, `exercise`, `workout` (session + set), `stats`, `bodyMetric`, `admin`
เช่น เพิ่มเซต: `routes/workout.routes.js` → `controllers/workout.controller.js#addSet` → `services/workout.service.js#addSet` → `repositories/set.repository.js#create`

## ติดตั้งและรัน

**สิ่งที่ต้องมี:** Node.js 18 ขึ้นไป และ PostgreSQL 13 ขึ้นไป

### 1) สร้างฐานข้อมูลและตาราง

```bash
createdb gymlog
psql -d gymlog -f schema.sql
```

ถ้าต้องระบุผู้ใช้: `psql -U postgres -d gymlog -f schema.sql`
มีฐานข้อมูลเวอร์ชันเก่าอยู่แล้ว: รันคำสั่งเดิมได้เลย สคริปต์จะเพิ่มคอลัมน์ใหม่ให้โดยไม่ลบข้อมูล

### 2) ตั้งค่า environment

```bash
cp .env.example .env
```

แก้ `.env`:

- `DATABASE_URL` ให้ตรงกับเครื่อง เช่น `postgresql://postgres:password@localhost:5432/gymlog`
- `JWT_SECRET` ยาวอย่างน้อย 32 ตัวอักษร สร้างได้ด้วย
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 3) ติดตั้ง package และเริ่มเซิร์ฟเวอร์

```bash
npm install
npm run seed:demo  # (ไม่บังคับ) สร้างบัญชีตัวอย่าง + ประวัติ 6 สัปดาห์ สำหรับสาธิต
npm start          # หรือ npm run dev เพื่อ auto-restart ตอนแก้โค้ด
```

เปิด <http://localhost:3000>

### บัญชีสำหรับสาธิต (หลังรัน `npm run seed:demo`)

| อีเมล | รหัสผ่าน | สิทธิ์ |
|---|---|---|
| demo@gymlog.app | demo1234 | USER (มีประวัติการเล่นและค่าร่างกาย 6 สัปดาห์) |
| admin@gymlog.app | admin1234 | ADMIN |

ตั้งบัญชีอื่นเป็น Admin คนแรกด้วย SQL: `UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';`
หลังจากนั้นตั้ง/ถอดสิทธิ์ผ่านหน้า Admin ได้เลย

### ทดสอบบนมือถือ (Wi-Fi เดียวกัน)

เปิด `http://<IP เครื่องคอมพิวเตอร์>:3000` บนมือถือ (ดู IP ด้วย `ipconfig` / `ifconfig`)

## วิธีใช้งาน

1. **วันนี้** — เลือกท่า ระบบแสดงประวัติครั้งล่าสุด แตะชิปเพื่อเติมน้ำหนัก/ครั้ง → กด **＋ เพิ่มเซต** → เล่นเสร็จกด **✔** แถวเป็นสีเขียวและตัวจับเวลาพักขึ้นมา (ปรับเวลาพักได้ที่ “เวลาพักหลังกด ✔”) เขียนโน้ตได้ท้ายหน้า
2. **ประวัติ** — ดูภาพรวม เลือกท่าเพื่อดูกราฟ สลับดูน้ำหนักสูงสุด / 1RM / ปริมาณ แตะวันที่เพื่อดูทุกเซต แก้โน้ต หรือลบทั้งวัน
3. **ท่าเล่น** — เพิ่มท่าที่ไม่มีในรายการ (ขึ้น ★ ในตัวเลือกท่า) แก้ด้วย ✎ ลบด้วย 🗑 (ท่าที่เคยบันทึกเซตแล้วลบไม่ได้ เพื่อไม่ให้ประวัติหาย)
4. **ร่างกาย** — เลือกวันที่ กรอกค่าที่วัดได้ (จากเครื่องชั่งหรือ InBody) แล้วกดบันทึก เลือกวันที่เคยบันทึกจะดึงค่าเดิมมาให้แก้ ดูกราฟ %ไขมัน / มวลกล้ามเนื้อ / น้ำหนักตัว ได้
5. **Admin** (เห็นเฉพาะ ADMIN) — ดูสถิติระบบ ค้นหาผู้ใช้ ตั้ง/ถอด Admin และเพิ่ม/แก้/ลบท่ากลางที่ทุกคนเห็น

## ฐานข้อมูล

```
users 1──N workout_sessions 1──N workout_sets N──1 exercises
users 1──N exercises (ท่าส่วนตัว: created_by)
users 1──N body_metrics (ค่าร่างกาย วันละ 1 แถว)
```

| ตาราง | คอลัมน์สำคัญ |
|---|---|
| users | id, email (unique), password_hash, name, role (USER/ADMIN), **rest_seconds**, created_at |
| exercises | id, name, category, equipment_type, **created_by** (NULL = ท่ากลาง), **created_at** |
| workout_sessions | id, user_id, workout_date, notes |
| workout_sets | id, session_id, exercise_id, set_number, weight_kg, reps, is_completed |
| **body_metrics** | id, user_id, measured_on, weight_kg (20-300), body_fat_pct (2-70), muscle_mass_kg (5-150) · unique (user_id, measured_on) · ต้องมีอย่างน้อย 1 ค่า |

ชื่อท่ากลางห้ามซ้ำกัน และชื่อท่าส่วนตัวห้ามซ้ำภายในผู้ใช้คนเดียวกัน (partial unique index)

## REST API (`/api/v1`)

ทุก endpoint ยกเว้น register / login / logout ต้องมี cookie ล็อกอิน

| Method | Path | หน้าที่ |
|---|---|---|
| POST | `/auth/register` | สมัครสมาชิก (bcrypt, role = USER เสมอ) |
| POST | `/auth/login` | เข้าสู่ระบบ → JWT ใน HTTP-Only cookie |
| POST | `/auth/logout` | ออกจากระบบ |
| GET | `/auth/me` | ข้อมูลผู้ใช้ปัจจุบัน |
| PATCH | `/auth/me` | **ใหม่** ตั้งเวลาพัก `rest_seconds` (15-600) |
| GET | `/exercises` | ท่ากลาง + ท่าของฉัน |
| POST | `/exercises` | **ใหม่** เพิ่มท่าของฉัน |
| PATCH / DELETE | `/exercises/:id` | **ใหม่** แก้ / ลบท่าของฉัน |
| GET | `/workouts/sessions/today?date=` | session ของวันนั้น + เซต |
| GET | `/workouts/sessions?limit=&offset=` | **ใหม่** ประวัติทุกวันพร้อมสรุป (แบ่งหน้า) |
| POST | `/workouts/sessions` | สร้าง session |
| GET / PATCH / DELETE | `/workouts/sessions/:id` | **ใหม่** ดูรายละเอียด / แก้โน้ต / ลบทั้งวัน |
| GET | `/workouts/history/:exercise_id` | เซตของครั้งล่าสุดของท่านี้ |
| POST | `/workouts/sets` | บันทึกเซต |
| PATCH / DELETE | `/workouts/sets/:id` | แก้ / ลบเซต |
| GET | `/stats/summary` | **ใหม่** ภาพรวมทั้งหมด |
| GET | `/stats/prs` | **ใหม่** สถิติส่วนตัวของแต่ละท่า |
| GET | `/stats/progress/:exercise_id` | **ใหม่** ข้อมูลกราฟ 30 ครั้งล่าสุด |
| GET | `/body-metrics?limit=` | **ใหม่** ค่าร่างกายย้อนหลัง |
| POST | `/body-metrics` | **ใหม่** บันทึกค่าของวันนั้น (วันเดิม = แทนค่าเดิม) |
| DELETE | `/body-metrics/:id` | **ใหม่** ลบค่าของวันนั้น |
| GET | `/admin/stats` | **ใหม่** (ADMIN) สถิติระบบ + ท่ายอดนิยม |
| GET | `/admin/users?q=` | **ใหม่** (ADMIN) รายชื่อผู้ใช้ |
| PATCH | `/admin/users/:id` | **ใหม่** (ADMIN) เปลี่ยน role |
| GET / POST | `/admin/exercises` | **ใหม่** (ADMIN) ดู / เพิ่มท่ากลาง |
| PATCH / DELETE | `/admin/exercises/:id` | **ใหม่** (ADMIN) แก้ / ลบท่ากลาง |

## ความปลอดภัย

- รหัสผ่านเก็บเป็น bcrypt hash (cost 12); JWT อยู่ใน cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` เมื่อ `NODE_ENV=production`)
- Helmet (CSP ฯลฯ), CORS ปิดเป็นค่าเริ่มต้น, rate limit ที่ register/login, จำกัดขนาด body, SQL แบบ parameterized ทั้งหมด
- ทุกการอ่าน/แก้/ลบ session, เซต, ท่าส่วนตัว และค่าร่างกาย ตรวจว่าเป็นของผู้ใช้คนนั้น — คนอื่นได้ 404
- endpoint `/admin/*` ตรวจ role จากฐานข้อมูลทุกครั้ง (ถอดสิทธิ์แล้วมีผลทันที แม้ token เก่ายังไม่หมดอายุ) และ Admin เปลี่ยน role ของตัวเองไม่ได้
- Frontend สร้าง DOM ด้วย `textContent` ไม่ใช้ `innerHTML` กับข้อมูลผู้ใช้ กราฟวาดด้วย SVG เอง ไม่พึ่ง library ภายนอก

## ขึ้น Production

- ตั้ง `NODE_ENV=production` และให้บริการผ่าน **HTTPS**
- **อย่า** commit หรือใส่ไฟล์ `.env` ลงใน zip ที่ส่ง (มีรหัสผ่านฐานข้อมูลและ JWT secret)
