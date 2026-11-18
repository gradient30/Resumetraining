-- 0002: accounts and per-user data separation.
--
-- The database has one pre-auth profile row (created 2026-11-18, before
-- accounts existed) and no check-ins or waist entries. The old rows are
-- kept with user_id NULL and claimed by the first account that registers
-- (see the register handler in src/worker.ts). Until claimed, they are
-- invisible to every account because all reads filter by user_id.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- profiles: one row per user, keyed by user_id. The old table only allowed
-- a single row (CHECK id = 1), so it is recreated.
CREATE TABLE IF NOT EXISTS profiles_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  age INTEGER,
  height_cm REAL NOT NULL DEFAULT 180,
  weight_kg REAL NOT NULL DEFAULT 76,
  waist_cm REAL,
  sleep_hours REAL,
  sitting_hours REAL,
  daily_steps INTEGER,
  pain_now INTEGER NOT NULL DEFAULT 0,
  leg_pain INTEGER NOT NULL DEFAULT 0,
  leg_numbness INTEGER NOT NULL DEFAULT 0,
  leg_weakness INTEGER NOT NULL DEFAULT 0,
  red_flag INTEGER NOT NULL DEFAULT 0,
  single_leg_seconds INTEGER,
  wall_sit_seconds INTEGER,
  daily_minutes INTEGER,
  equipment TEXT,
  focus TEXT,
  recommended_phase INTEGER NOT NULL DEFAULT 1,
  current_phase INTEGER NOT NULL DEFAULT 1,
  start_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO profiles_new (id, user_id, age, height_cm, weight_kg, waist_cm, sleep_hours, sitting_hours, daily_steps, pain_now, leg_pain, leg_numbness, leg_weakness, red_flag, single_leg_seconds, wall_sit_seconds, daily_minutes, equipment, focus, recommended_phase, current_phase, start_date, created_at, updated_at)
  SELECT id, NULL, age, height_cm, weight_kg, waist_cm, sleep_hours, sitting_hours, daily_steps, pain_now, leg_pain, leg_numbness, leg_weakness, red_flag, single_leg_seconds, wall_sit_seconds, daily_minutes, equipment, focus, recommended_phase, current_phase, start_date, created_at, updated_at FROM profiles;
DROP TABLE profiles;
ALTER TABLE profiles_new RENAME TO profiles;

-- check_ins: uniqueness is per user now, not global per date.
CREATE TABLE IF NOT EXISTS check_ins_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  date TEXT NOT NULL,
  morning INTEGER NOT NULL DEFAULT 0,
  micro_breaks INTEGER NOT NULL DEFAULT 0,
  core INTEGER NOT NULL DEFAULT 0,
  walking_minutes INTEGER NOT NULL DEFAULT 0,
  bedtime_stretch INTEGER NOT NULL DEFAULT 0,
  pain INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);
INSERT INTO check_ins_new (id, user_id, date, morning, micro_breaks, core, walking_minutes, bedtime_stretch, pain, note, created_at)
  SELECT id, NULL, date, morning, micro_breaks, core, walking_minutes, bedtime_stretch, pain, note, created_at FROM check_ins;
DROP TABLE check_ins;
ALTER TABLE check_ins_new RENAME TO check_ins;
CREATE INDEX IF NOT EXISTS idx_check_ins_user_date ON check_ins(user_id, date);

-- waist_entries: same per-user scoping.
CREATE TABLE IF NOT EXISTS waist_entries_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  date TEXT NOT NULL,
  waist_cm REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);
INSERT INTO waist_entries_new (id, user_id, date, waist_cm, created_at)
  SELECT id, NULL, date, waist_cm, created_at FROM waist_entries;
DROP TABLE waist_entries;
ALTER TABLE waist_entries_new RENAME TO waist_entries;
CREATE INDEX IF NOT EXISTS idx_waist_user_date ON waist_entries(user_id, date);
