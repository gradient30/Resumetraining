-- 0004: v2 方案新增字段（最终审核报告 P0-3/P0-4/P0-8/P0-9/P1-1/P1-4/P1-5/P1-7/P1-15/P1-16
-- 对应的服务端存储；界面与判定逻辑见 src/worker.ts 与 src/api.ts）。
--
-- 只用 ADD COLUMN，不重建表、不删数据。
-- 注意：D1/SQLite 的 ADD COLUMN 不支持 IF NOT EXISTS 语法，下面每条
-- ALTER 各自独立；重复执行会报错是预期的——wrangler migrations apply
-- 对每个迁移文件只执行一次，不要手动重复跑本文件。
--
-- pain 列保持 0002 的定义（INTEGER NOT NULL DEFAULT 0），不改 NULL：
-- 前端 pain 为 null 时禁止保存，服务端收到 null 时按缺失返回 400。

-- profiles：基线自测新增项（v2 §2.5）、建档筛查（P1-1/P1-7）、黄旗与睡眠质量
-- （P1-4）、腰围个人目标（P0-10）。
ALTER TABLE profiles ADD COLUMN red_flag_items TEXT NOT NULL DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN single_leg_left INTEGER;
ALTER TABLE profiles ADD COLUMN single_leg_right INTEGER;
ALTER TABLE profiles ADD COLUMN side_plank_seconds INTEGER;
ALTER TABLE profiles ADD COLUMN smoking INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN diabetes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN annular_defect INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN recurrence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN heart_disease INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN hypertension INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN medication INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN exercise_chest_pain INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN doctor_assessed_leg INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN sleep_quality TEXT;
ALTER TABLE profiles ADD COLUMN yellow_flags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN waist_target_cm REAL;
ALTER TABLE profiles ADD COLUMN waist_target_mode TEXT;

-- check_ins：24 小时规则采集（P0-3/P1-5）、独立力量完成（P0-8）、饮食勾选
-- （P0-9）、睡眠与久坐时长（P1-15/P1-16）、每日马尾快筛（P0-1）。
ALTER TABLE check_ins ADD COLUMN strength INTEGER NOT NULL DEFAULT 0;
ALTER TABLE check_ins ADD COLUMN leg_pain INTEGER;
ALTER TABLE check_ins ADD COLUMN pain_location TEXT;
ALTER TABLE check_ins ADD COLUMN peak_pain INTEGER;
ALTER TABLE check_ins ADD COLUMN relieved_30min INTEGER;
ALTER TABLE check_ins ADD COLUMN new_leg_symptoms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE check_ins ADD COLUMN morning_vs_baseline REAL;
ALTER TABLE check_ins ADD COLUMN diet_veg_first INTEGER NOT NULL DEFAULT 0;
ALTER TABLE check_ins ADD COLUMN diet_no_sugary INTEGER NOT NULL DEFAULT 0;
ALTER TABLE check_ins ADD COLUMN sleep_hours REAL;
ALTER TABLE check_ins ADD COLUMN sitting_hours REAL;
ALTER TABLE check_ins ADD COLUMN red_flag_screen TEXT NOT NULL DEFAULT '[]';
