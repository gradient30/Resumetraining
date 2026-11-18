CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY CHECK (id = 1),
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

CREATE TABLE IF NOT EXISTS check_ins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  morning INTEGER NOT NULL DEFAULT 0,
  micro_breaks INTEGER NOT NULL DEFAULT 0,
  core INTEGER NOT NULL DEFAULT 0,
  walking_minutes INTEGER NOT NULL DEFAULT 0,
  bedtime_stretch INTEGER NOT NULL DEFAULT 0,
  pain INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date)
);

CREATE TABLE IF NOT EXISTS waist_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  waist_cm REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_check_ins_date ON check_ins(date);
CREATE INDEX IF NOT EXISTS idx_waist_date ON waist_entries(date);
