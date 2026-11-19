-- 0005: 自助找回密码（一次性 6 位重置码）。
--
-- 只用 CREATE TABLE / CREATE INDEX 增量，不重建表、不删数据。
-- password_resets 只存重置码的 SHA-256 哈希，绝不存明文码；
-- 响应与日志里也绝不输出明文码（码的投递由管理员在站外单独完成，
-- 本项目暂无邮件发送能力）。
-- expires_at 用 UTC "YYYY-MM-DD HH:MM:SS" 文本，与 sessions 的写法一致，
-- 以便与 datetime('now') 直接比较。

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
