-- =====================================================================
-- Gym Log Tracker : PostgreSQL schema
-- รันด้วย:  psql -d gymlog -f schema.sql
-- สคริปต์นี้รันซ้ำได้ (idempotent) ไม่ลบข้อมูลเดิม
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL       PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    name          VARCHAR(100) NOT NULL,
    role          VARCHAR(10)  NOT NULL DEFAULT 'USER'
                  CONSTRAINT users_role_check CHECK (role IN ('USER', 'ADMIN')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- exercises  (ท่าเล่น)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercises (
    id             SERIAL       PRIMARY KEY,
    name           VARCHAR(100) NOT NULL UNIQUE,
    category       VARCHAR(30)  NOT NULL
                   CONSTRAINT exercises_category_check
                   CHECK (category IN ('Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Other')),
    equipment_type VARCHAR(30)  NOT NULL DEFAULT 'Other'
);

-- ---------------------------------------------------------------------
-- workout_sessions  (การเข้ายิม 1 ครั้ง / 1 วัน)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_sessions (
    id           SERIAL  PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workout_date DATE    NOT NULL DEFAULT CURRENT_DATE,
    notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_date
    ON workout_sessions (user_id, workout_date DESC);

-- ---------------------------------------------------------------------
-- workout_sets  (แต่ละเซตที่เล่น)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_sets (
    id           SERIAL       PRIMARY KEY,
    session_id   INTEGER      NOT NULL REFERENCES workout_sessions (id) ON DELETE CASCADE,
    exercise_id  INTEGER      NOT NULL REFERENCES exercises (id) ON DELETE RESTRICT,
    set_number   INTEGER      NOT NULL CONSTRAINT workout_sets_set_number_check CHECK (set_number >= 1),
    weight_kg    NUMERIC(6,2) NOT NULL CONSTRAINT workout_sets_weight_check CHECK (weight_kg >= 0),
    reps         INTEGER      NOT NULL CONSTRAINT workout_sets_reps_check CHECK (reps >= 0),
    is_completed BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sets_session
    ON workout_sets (session_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise_session
    ON workout_sets (exercise_id, session_id);

-- =====================================================================
-- v2 : ฟีเจอร์ใหม่ (รันซ้ำได้ และอัปเกรดฐานข้อมูลเดิมได้ทันที)
-- =====================================================================

-- ตั้งเวลาพักเอง (วินาที) ต่อผู้ใช้
ALTER TABLE users ADD COLUMN IF NOT EXISTS rest_seconds INTEGER NOT NULL DEFAULT 90;
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_rest_seconds_check CHECK (rest_seconds BETWEEN 15 AND 600);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ท่าเล่นที่ผู้ใช้สร้างเอง: created_by = NULL คือท่ากลางของระบบ (Admin ดูแล)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ชื่อท่ากลางห้ามซ้ำกัน / ชื่อท่าส่วนตัวห้ามซ้ำกันภายในผู้ใช้คนเดียว
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_exercises_global_name
    ON exercises (lower(name)) WHERE created_by IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_exercises_user_name
    ON exercises (created_by, lower(name)) WHERE created_by IS NOT NULL;

-- ---------------------------------------------------------------------
-- body_metrics  (ค่าร่างกาย: น้ำหนักตัว / %ไขมัน / มวลกล้ามเนื้อ, วันละ 1 แถว)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS body_metrics (
    id             SERIAL       PRIMARY KEY,
    user_id        INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    measured_on    DATE         NOT NULL DEFAULT CURRENT_DATE,
    weight_kg      NUMERIC(5,2) CONSTRAINT body_metrics_weight_check CHECK (weight_kg BETWEEN 20 AND 300),
    body_fat_pct   NUMERIC(4,1) CONSTRAINT body_metrics_fat_check    CHECK (body_fat_pct BETWEEN 2 AND 70),
    muscle_mass_kg NUMERIC(5,2) CONSTRAINT body_metrics_muscle_check CHECK (muscle_mass_kg BETWEEN 5 AND 150),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT body_metrics_one_per_day UNIQUE (user_id, measured_on),
    CONSTRAINT body_metrics_has_value
        CHECK (weight_kg IS NOT NULL OR body_fat_pct IS NOT NULL OR muscle_mass_kg IS NOT NULL)
);

-- ---------------------------------------------------------------------
-- Seed: ท่าเล่นเริ่มต้น (ท่ากลาง)
-- ---------------------------------------------------------------------
INSERT INTO exercises (name, category, equipment_type) VALUES
    ('Barbell Bench Press',     'Chest',     'Barbell'),
    ('Incline Dumbbell Press',  'Chest',     'Dumbbell'),
    ('Chest Fly',               'Chest',     'Machine'),
    ('Push-up',                 'Chest',     'Bodyweight'),
    ('Deadlift',                'Back',      'Barbell'),
    ('Lat Pulldown',            'Back',      'Cable'),
    ('Seated Cable Row',        'Back',      'Cable'),
    ('Barbell Row',             'Back',      'Barbell'),
    ('Pull-up',                 'Back',      'Bodyweight'),
    ('Barbell Squat',           'Legs',      'Barbell'),
    ('Leg Press',               'Legs',      'Machine'),
    ('Romanian Deadlift',       'Legs',      'Barbell'),
    ('Leg Extension',           'Legs',      'Machine'),
    ('Leg Curl',                'Legs',      'Machine'),
    ('Standing Calf Raise',     'Legs',      'Machine'),
    ('Overhead Press',          'Shoulders', 'Barbell'),
    ('Dumbbell Lateral Raise',  'Shoulders', 'Dumbbell'),
    ('Face Pull',               'Shoulders', 'Cable'),
    ('Barbell Curl',            'Arms',      'Barbell'),
    ('Dumbbell Hammer Curl',    'Arms',      'Dumbbell'),
    ('Triceps Pushdown',        'Arms',      'Cable'),
    ('Skull Crusher',           'Arms',      'Barbell'),
    ('Plank',                   'Core',      'Bodyweight'),
    ('Cable Crunch',            'Core',      'Cable'),
    ('Treadmill Run',           'Cardio',    'Machine')
ON CONFLICT (lower(name)) WHERE created_by IS NULL DO NOTHING;

COMMIT;
