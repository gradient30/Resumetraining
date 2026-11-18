-- 0003: per-IP rate limiting for the auth endpoints.
-- One row per key (auth:<ip>), counting attempts inside a fixed window.
-- Rows outside the window are pruned on each check (see checkRateLimit
-- in src/worker.ts); no separate cleanup job is needed.

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
