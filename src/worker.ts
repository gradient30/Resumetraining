/// <reference types="@cloudflare/workers-types" />
export interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

type Row = Record<string, unknown>

// 安全响应头（最终审核报告 P2-13）：
// Strict-Transport-Security: max-age=63072000; includeSubDomains
// X-Content-Type-Options: nosniff
// Content-Security-Policy: default-src 'self'; img-src 'self' data:;
//   style-src 'self' 'unsafe-inline'; script-src 'self'
// （只作用于本 Worker 返回的 /api/* JSON 响应；静态资源走 ASSETS 原样返回。）
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'",
    },
  })
}

function bad(error: string, message: string): Response {
  return json({ error, message }, 400)
}

// 请求体 JSON 解析失败单独返回 400，不走到外层 500。
// 只接受 JSON 对象体；解析失败或体不是对象时返回 null。
async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b: unknown = await request.json()
    if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>
    return null
  } catch {
    return null
  }
}

function parseJsonArray(v: unknown): string[] {
  if (typeof v !== 'string') return []
  try {
    const a: unknown = JSON.parse(v)
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function profileFromRow(r: Row | null) {
  if (!r) return null
  return {
    age: r.age ?? null,
    height_cm: r.height_cm,
    weight_kg: r.weight_kg,
    waist_cm: r.waist_cm ?? null,
    sleep_hours: r.sleep_hours ?? null,
    sitting_hours: r.sitting_hours ?? null,
    daily_steps: r.daily_steps ?? null,
    pain_now: r.pain_now,
    leg_pain: !!r.leg_pain,
    leg_numbness: !!r.leg_numbness,
    leg_weakness: !!r.leg_weakness,
    red_flag: !!r.red_flag,
    red_flag_items: parseJsonArray(r.red_flag_items),
    single_leg_seconds: r.single_leg_seconds ?? null,
    single_leg_left: r.single_leg_left ?? null,
    single_leg_right: r.single_leg_right ?? null,
    side_plank_seconds: r.side_plank_seconds ?? null,
    wall_sit_seconds: r.wall_sit_seconds ?? null,
    daily_minutes: r.daily_minutes ?? null,
    equipment: r.equipment ?? '',
    focus: r.focus ?? '',
    smoking: !!r.smoking,
    diabetes: !!r.diabetes,
    annular_defect: !!r.annular_defect,
    recurrence: !!r.recurrence,
    heart_disease: !!r.heart_disease,
    hypertension: !!r.hypertension,
    medication: !!r.medication,
    exercise_chest_pain: !!r.exercise_chest_pain,
    doctor_assessed_leg: !!r.doctor_assessed_leg,
    sleep_quality: r.sleep_quality ?? null,
    yellow_flags: parseJsonArray(r.yellow_flags),
    waist_target_cm: r.waist_target_cm ?? null,
    waist_target_mode: r.waist_target_mode ?? null,
    recommended_phase: r.recommended_phase,
    current_phase: r.current_phase,
    start_date: r.start_date ?? null,
  }
}

function checkInFromRow(r: Row) {
  return {
    date: r.date,
    morning: !!r.morning,
    micro_breaks: r.micro_breaks,
    core: !!r.core,
    strength: !!r.strength,
    walking_minutes: r.walking_minutes,
    bedtime_stretch: !!r.bedtime_stretch,
    pain: r.pain,
    leg_pain: r.leg_pain ?? null,
    pain_location: r.pain_location ?? null,
    peak_pain: r.peak_pain ?? null,
    relieved_30min: r.relieved_30min == null ? null : !!r.relieved_30min,
    new_leg_symptoms: !!r.new_leg_symptoms,
    morning_vs_baseline: r.morning_vs_baseline ?? null,
    diet_veg_first: !!r.diet_veg_first,
    diet_no_sugary: !!r.diet_no_sugary,
    sleep_hours: r.sleep_hours ?? null,
    sitting_hours: r.sitting_hours ?? null,
    red_flag_screen: parseJsonArray(r.red_flag_screen),
    note: r.note ?? '',
  }
}

// ---------- 服务端校验（最终审核报告 P1-19） ----------

// validDate：YYYY-MM-DD 且为真实日期，且不晚于“今天 + 1 天”。
// 服务端没有用户时区：客户端 todayStr 是本地日期，北京时间 00:00–07:59
// 打卡时本地日期比 UTC 日期晚一天；只允许到 UTC+1 天可覆盖全球
// UTC+14 以内的全部时区，同时仍拒绝真正的未来日期（> 明天）。
// 升阶段窗口仍用 UTC 口径（见 /api/profile/phase），误差 < 1 天。
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}
function validDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  return s <= tomorrow
}

function isIntInRange(v: unknown, min: number, max: number): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
}

function isNumInRange(v: unknown, min: number, max: number): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
}

function isStrMaxLen(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max
}

function isStrArrayMaxLen(v: unknown, max: number): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length <= max)
}

// 字段缺失（undefined）或为 null 时跳过校验（用服务端默认值）；
// 只有传了非法值时才返回 400。必填字段由各 handler 另行检查。
function checkOptInt(
  p: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): Response | null {
  const v = p[key]
  if (v == null) return null
  if (!isIntInRange(v, min, max)) return bad('invalid_field', `${key} 须为 ${min}–${max} 的整数`)
  return null
}

function checkOptNum(
  p: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): Response | null {
  const v = p[key]
  if (v == null) return null
  if (!isNumInRange(v, min, max)) return bad('invalid_field', `${key} 须为 ${min}–${max} 的数字`)
  return null
}

function checkOptStr(
  p: Record<string, unknown>,
  key: string,
  max: number,
): Response | null {
  const v = p[key]
  if (v == null) return null
  if (!isStrMaxLen(v, max)) return bad('invalid_field', `${key} 最多 ${max} 个字符`)
  return null
}

function checkOptStrArray(
  p: Record<string, unknown>,
  key: string,
  max: number,
): Response | null {
  const v = p[key]
  if (v == null) return null
  if (!isStrArrayMaxLen(v, max)) return bad('invalid_field', `${key} 须为数组，每项最多 ${max} 个字符`)
  return null
}

// ---------- auth ----------

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// 会话 token 只存 SHA-256 哈希（最终审核报告 P1-21）：库泄露也不等于
// 账号被接管。注意：部署后旧的明文会话全部失效，所有用户需重新登录一次。
async function sha256Hex(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' },
    key,
    256,
  )
  return bufToB64(bits)
}

async function verifyPassword(password: string, saltB64: string, hashB64: string): Promise<boolean> {
  const hash = await hashPassword(password, b64ToBytes(saltB64))
  return constantTimeEqual(hash, hashB64)
}

async function createSession(env: Env, userId: number): Promise<string> {
  const token = newToken()
  // Store in SQLite datetime format ("YYYY-MM-DD HH:MM:SS", UTC) so the
  // auth check `expires_at > datetime('now')` compares like with like.
  // The previous ISO form ("...T...Z" with millis) compared 'T' > ' ' on
  // the expiry date, so a session stayed valid until the end of that day
  // — up to ~24h past the intended 30 days.
  const expires = new Date(Date.now() + 30 * 86400000).toISOString().replace('T', ' ').slice(0, 19)
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, ?3)')
    .bind(await sha256Hex(token), userId, expires)
    .run()
  return token
}

async function bearerTokenHash(request: Request): Promise<string | null> {
  const h = request.headers.get('Authorization')
  if (!h || !h.startsWith('Bearer ')) return null
  const token = h.slice(7)
  if (!token) return null
  return sha256Hex(token)
}

async function authUserId(request: Request, env: Env): Promise<number | null> {
  const tokenHash = await bearerTokenHash(request)
  if (!tokenHash) return null
  const row = await env.DB.prepare(
    "SELECT user_id FROM sessions WHERE token = ?1 AND expires_at > datetime('now')",
  )
    .bind(tokenHash)
    .first<{ user_id: number }>()
  return row ? row.user_id : null
}

// 限流：单条原子 UPSERT 计数（最终审核报告 P2-12）。
// INSERT ... ON CONFLICT DO UPDATE 一次完成“窗口过期则重置为 1，
// 否则 count+1”；之后读回 count，count > limit 即超限。
// 注意：本 SQL 未在本地 D1 环境验证过（无本地 D1），部署后需先实测
// 注册/登录限流再放开。
async function checkRateLimit(env: Env, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(now - windowSeconds).run()
  await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, window_start) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN excluded.window_start - window_start >= ?3 THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN excluded.window_start - window_start >= ?3 THEN excluded.window_start ELSE window_start END`,
  )
    .bind(key, now, windowSeconds)
    .run()
  const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE key = ?1')
    .bind(key)
    .first<{ count: number }>()
  return !!row && row.count <= limit
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      try {
        // ----- auth endpoints (no session needed) -----
        if (url.pathname === '/api/auth/register' && request.method === 'POST') {
          const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
          if (!(await checkRateLimit(env, `auth:${ip}`, 10, 600))) {
            return json({ error: 'too_many_requests', message: '尝试太多次了，请 10 分钟后再试' }, 429)
          }
          const body = await readJson(request)
          if (!body) return bad('invalid_json', '请求内容不是合法的 JSON')
          const email = String(body.email ?? '').trim().toLowerCase()
          const password = String(body.password ?? '')
          if (!isEmail(email)) return json({ error: 'invalid_email', message: '邮箱格式不对，检查一下' }, 400)
          // 密码至少 8 位（最终审核报告 P1-22）。上限 128 位见任务说明，
          // 服务端只校验下限；超长密码由 PBKDF2 正常处理。
          if (password.length < 8) return json({ error: 'weak_password', message: '密码至少 8 位，建议含字母+数字' }, 400)
          const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first()
          if (existing) return json({ error: 'email_taken', message: '这个邮箱已经注册过了，直接登录吧' }, 409)
          const salt = crypto.getRandomValues(new Uint8Array(16))
          const hash = await hashPassword(password, salt)
          let ins
          try {
            ins = await env.DB.prepare(
              'INSERT INTO users (email, password_hash, password_salt) VALUES (?1, ?2, ?3)',
            )
              .bind(email, hash, bufToB64(salt.buffer))
              .run()
          } catch (err) {
            // Concurrent registration with the same email: the SELECT
            // above passed for both, the UNIQUE constraint catches one.
            if (String(err).includes('UNIQUE constraint')) {
              return json({ error: 'email_taken', message: '这个邮箱已经注册过了，直接登录吧' }, 409)
            }
            throw err
          }
          const userId = ins.meta.last_row_id as number
          if (!userId) throw new Error('failed to create user')
          // 注册后只创建空档案，不认领任何旧数据（最终审核报告 P1-17）：
          // 0002 时代的认领 UPDATE 已删除。如需迁移旧无主行，改由管理员
          // 在后台手动指定 user_id。
          const token = await createSession(env, userId)
          return json({ token, user: { id: userId, email } })
        }

        if (url.pathname === '/api/auth/login' && request.method === 'POST') {
          const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
          const body = await readJson(request)
          if (!body) return bad('invalid_json', '请求内容不是合法的 JSON')
          const email = String(body.email ?? '').trim().toLowerCase()
          const password = String(body.password ?? '')
          // 登录限流改为“邮箱 + IP”组合键（最终审核报告 P1-20）：
          // 只按邮箱限流会被用来锁死他人账号；只按 IP 又拦不住换 IP
          // 猜密码。10 次 / 10 分钟。
          if (!(await checkRateLimit(env, `login:${email}:${ip}`, 10, 600))) {
            return json({ error: 'too_many_requests', message: '尝试太多次了，请 10 分钟后再试' }, 429)
          }
          const user = await env.DB.prepare(
            'SELECT id, email, password_hash, password_salt FROM users WHERE email = ?1',
          )
            .bind(email)
            .first<Row>()
          if (!user) return json({ error: 'invalid_credentials', message: '邮箱或密码不对，再试一次' }, 401)
          const ok = await verifyPassword(password, String(user.password_salt), String(user.password_hash))
          if (!ok) return json({ error: 'invalid_credentials', message: '邮箱或密码不对，再试一次' }, 401)
          const token = await createSession(env, Number(user.id))
          return json({ token, user: { id: user.id, email: user.email } })
        }

        if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
          const tokenHash = await bearerTokenHash(request)
          if (tokenHash) {
            await env.DB.prepare('DELETE FROM sessions WHERE token = ?1').bind(tokenHash).run()
          }
          return json({ ok: true })
        }

        // 找回密码（第一步）：生成一次性 6 位数字重置码，只把 SHA-256
        // 哈希存进 password_resets，15 分钟过期，旧码同时作废。
        // 本项目暂无邮件发送能力，码由管理员在站外单独交给用户，
        // 所以响应里绝不返回重置码；邮箱不存在时也返回同样的 ok，
        // 不枚举账号是否存在。限流：邮箱 + IP 组合键，5 次 / 小时。
        if (url.pathname === '/api/auth/forgot-password' && request.method === 'POST') {
          const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
          const body = await readJson(request)
          if (!body) return bad('invalid_json', '请求内容不是合法的 JSON')
          const email = String(body.email ?? '').trim().toLowerCase()
          if (!isEmail(email)) return json({ error: 'invalid_email', message: '邮箱格式不对，检查一下' }, 400)
          if (!(await checkRateLimit(env, `forgot:${email}:${ip}`, 5, 3600))) {
            return json({ error: 'too_many_requests', message: '尝试太多次了，请 1 小时后再试' }, 429)
          }
          const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first()
          if (user) {
            const digits = crypto.getRandomValues(new Uint8Array(6))
            const code = [...digits].map((b) => String(b % 10)).join('')
            const expires = new Date(Date.now() + 15 * 60000).toISOString().replace('T', ' ').slice(0, 19)
            await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE email = ?1 AND used = 0')
              .bind(email)
              .run()
            await env.DB.prepare(
              'INSERT INTO password_resets (email, token_hash, expires_at) VALUES (?1, ?2, ?3)',
            )
              .bind(email, await sha256Hex(code), expires)
              .run()
          }
          return json({ ok: true, message: '如果该邮箱已注册，重置码已生成，请联系管理员获取' })
        }

        // 找回密码（第二步）：凭邮箱 + 6 位重置码 + 新密码重置。
        // 码不对、过期、已用、邮箱不存在一律返回同一条通用提示，
        // 不透露是哪一种失败。成功后换新盐 + 新哈希，并删除该用户
        // 全部会话，强制重新登录。限流：邮箱 + IP 组合键，10 次 / 10 分钟。
        if (url.pathname === '/api/auth/reset-password' && request.method === 'POST') {
          const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
          const body = await readJson(request)
          if (!body) return bad('invalid_json', '请求内容不是合法的 JSON')
          const email = String(body.email ?? '').trim().toLowerCase()
          const code = String(body.code ?? '')
          const newPassword = String(body.new_password ?? '')
          if (!isEmail(email)) return json({ error: 'invalid_email', message: '邮箱格式不对，检查一下' }, 400)
          if (!/^\d{6}$/.test(code)) {
            return json({ error: 'invalid_reset', message: '重置码不对或已过期，请重新获取' }, 400)
          }
          if (newPassword.length < 8) {
            return json({ error: 'weak_password', message: '新密码至少 8 位，建议含字母+数字' }, 400)
          }
          if (!(await checkRateLimit(env, `reset:${email}:${ip}`, 10, 600))) {
            return json({ error: 'too_many_requests', message: '尝试太多次了，请 10 分钟后再试' }, 429)
          }
          const genericFail = json(
            { error: 'invalid_reset', message: '重置码不对或已过期，请重新获取' },
            400,
          )
          const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?1')
            .bind(email)
            .first<{ id: number }>()
          if (!user) return genericFail
          const codeHash = await sha256Hex(code)
          const { results: candidates } = await env.DB.prepare(
            "SELECT id, token_hash FROM password_resets WHERE email = ?1 AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC",
          )
            .bind(email)
            .all<{ id: number; token_hash: string }>()
          const match = candidates.find((r) => constantTimeEqual(codeHash, String(r.token_hash)))
          if (!match) return genericFail
          const salt = crypto.getRandomValues(new Uint8Array(16))
          const hash = await hashPassword(newPassword, salt)
          await env.DB.prepare('UPDATE users SET password_hash = ?1, password_salt = ?2 WHERE id = ?3')
            .bind(hash, bufToB64(salt.buffer), user.id)
            .run()
          await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE id = ?1').bind(match.id).run()
          await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(user.id).run()
          return json({ ok: true, message: '密码已重置，请用新密码登录' })
        }

        if (url.pathname === '/api/auth/me' && request.method === 'GET') {
          const userId = await authUserId(request, env)
          if (!userId) return json({ error: 'unauthorized', message: '请先登录' }, 401)
          const user = await env.DB.prepare('SELECT id, email FROM users WHERE id = ?1')
            .bind(userId)
            .first<Row>()
          if (!user) return json({ error: 'unauthorized', message: '请先登录' }, 401)
          return json({ id: user.id, email: user.email })
        }

        // ----- data endpoints (session required, scoped by user) -----
        const userId = await authUserId(request, env)
        if (!userId) return json({ error: 'unauthorized', message: '请先登录' }, 401)

        // 退出全部设备（最终审核报告 P1-21）：删该用户全部会话。
        if (url.pathname === '/api/auth/logout-all' && request.method === 'POST') {
          await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(userId).run()
          return json({ ok: true })
        }

        // 修改密码（最终审核报告 P1-22）：验证旧密码、新密码 ≥8 位；
        // 成功后吊销该用户其他会话，保留当前会话。
        if (url.pathname === '/api/auth/change-password' && request.method === 'POST') {
          const body = await readJson(request)
          if (!body) return bad('invalid_json', '请求内容不是合法的 JSON')
          const oldPassword = String(body.old_password ?? '')
          const newPassword = String(body.new_password ?? '')
          if (newPassword.length < 8) {
            return json({ error: 'weak_password', message: '新密码至少 8 位，建议含字母+数字' }, 400)
          }
          const user = await env.DB.prepare(
            'SELECT password_hash, password_salt FROM users WHERE id = ?1',
          )
            .bind(userId)
            .first<Row>()
          if (!user) return json({ error: 'unauthorized', message: '请先登录' }, 401)
          const ok = await verifyPassword(oldPassword, String(user.password_salt), String(user.password_hash))
          if (!ok) return json({ error: 'invalid_credentials', message: '旧密码不对，再试一次' }, 401)
          const salt = crypto.getRandomValues(new Uint8Array(16))
          const hash = await hashPassword(newPassword, salt)
          await env.DB.prepare('UPDATE users SET password_hash = ?1, password_salt = ?2 WHERE id = ?3')
            .bind(hash, bufToB64(salt.buffer), userId)
            .run()
          const currentHash = await bearerTokenHash(request)
          if (currentHash) {
            await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1 AND token != ?2')
              .bind(userId, currentHash)
              .run()
          }
          return json({ ok: true })
        }

        // 导出我的数据（最终审核报告 P1-23）：该用户全部行，须登录。
        if (url.pathname === '/api/export' && request.method === 'GET') {
          const profileRow = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?1')
            .bind(userId)
            .first<Row>()
          const { results: checkIns } = await env.DB.prepare(
            'SELECT * FROM check_ins WHERE user_id = ?1 ORDER BY date ASC',
          )
            .bind(userId)
            .all<Row>()
          const { results: waistEntries } = await env.DB.prepare(
            'SELECT * FROM waist_entries WHERE user_id = ?1 ORDER BY date ASC',
          )
            .bind(userId)
            .all<Row>()
          return json({
            profile: profileFromRow(profileRow),
            check_ins: checkIns.map(checkInFromRow),
            waist_entries: waistEntries,
          })
        }

        // 删除账号（最终审核报告 P1-23）：验证密码后删该 user_id 全部行，
        // 先删子表再删 users；密码不对返回 401，不删任何数据。不可恢复。
        if (url.pathname === '/api/account' && request.method === 'DELETE') {
          const body = await readJson(request)
          if (!body) return bad('invalid_json', '请求内容不是合法的 JSON')
          const password = String(body.password ?? '')
          const user = await env.DB.prepare(
            'SELECT password_hash, password_salt FROM users WHERE id = ?1',
          )
            .bind(userId)
            .first<Row>()
          if (!user) return json({ error: 'unauthorized', message: '请先登录' }, 401)
          const ok = await verifyPassword(password, String(user.password_salt), String(user.password_hash))
          if (!ok) return json({ error: 'invalid_credentials', message: '密码不对，未删除任何数据' }, 401)
          await env.DB.prepare('DELETE FROM check_ins WHERE user_id = ?1').bind(userId).run()
          await env.DB.prepare('DELETE FROM waist_entries WHERE user_id = ?1').bind(userId).run()
          await env.DB.prepare('DELETE FROM profiles WHERE user_id = ?1').bind(userId).run()
          await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(userId).run()
          await env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(userId).run()
          return json({ ok: true })
        }

        // 升到第 3 阶段（最终审核报告 P0-4；v2 §三，手动确认）：
        // 服务端重新核对打卡记录后才改，不接受客户端直接改阶段。
        // 窗口：连续 14 个自然日，用 SQLite 日期函数 date('now','-13 days')
        // 取（含今天），与 validDate 同为 UTC 口径。
        if (url.pathname === '/api/profile/phase' && request.method === 'POST') {
          const profileRow = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?1')
            .bind(userId)
            .first<Row>()
          const currentPhase = Number(profileRow?.current_phase ?? 1)
          if (currentPhase >= 3) {
            return json({ error: 'already_phase3', message: '已经是第 3 阶段了' }, 400)
          }
          const { results } = await env.DB.prepare(
            `SELECT date, core, strength, pain, new_leg_symptoms, red_flag_screen
             FROM check_ins WHERE user_id = ?1 AND date >= date('now', '-13 days')
             ORDER BY date ASC`,
          )
            .bind(userId)
            .all<Row>()
          const missing: string[] = []
          const reasons: string[] = []
          const checkinDays = results.length
          const coreDays = results.filter((r) => r.core === 1).length
          const strengthDays = results.filter((r) => r.strength === 1).length
          if (checkinDays < 12) {
            missing.push('checkin_days')
            reasons.push(`近 14 天打卡 ${checkinDays} 天，还差 ${12 - checkinDays} 天`)
          }
          if (coreDays < 10) {
            missing.push('core_days')
            reasons.push(`核心完成 ${coreDays} 天，还差 ${10 - coreDays} 天`)
          }
          if (strengthDays < 4) {
            missing.push('strength_days')
            reasons.push(`力量完成 ${strengthDays} 天，还差 ${4 - strengthDays} 天`)
          }
          if (results.some((r) => Number(r.pain) > 3)) {
            missing.push('pain')
            reasons.push('这 14 天内有疼痛超过 3 分的打卡')
          }
          if (results.some((r) => r.new_leg_symptoms === 1)) {
            missing.push('new_leg_symptoms')
            reasons.push('这 14 天内有新发腿症状')
          }
          if (results.some((r) => parseJsonArray(r.red_flag_screen).length > 0)) {
            missing.push('red_flag_screen')
            reasons.push('这 14 天内有红旗筛查阳性')
          }
          let daysSinceStart: number | null = null
          if (profileRow?.start_date) {
            const s = await env.DB.prepare(
              "SELECT julianday('now') - julianday(?1) AS d",
            )
              .bind(String(profileRow.start_date))
              .first<{ d: number }>()
            if (s && Number.isFinite(Number(s.d))) daysSinceStart = Math.floor(Number(s.d))
          }
          if (daysSinceStart === null || daysSinceStart < 28) {
            missing.push('start_date')
            reasons.push(
              daysSinceStart === null
                ? '还没有开始日期（请先完成建档）'
                : `开始训练才 ${daysSinceStart} 天，需满 28 天（第 5 周起）`,
            )
          }
          if (missing.length > 0) {
            return json({ error: 'not_eligible', message: '还差：' + reasons.join('；'), missing }, 400)
          }
          await env.DB.prepare(
            "UPDATE profiles SET current_phase = 3, updated_at = datetime('now') WHERE user_id = ?1",
          )
            .bind(userId)
            .run()
          return json({ ok: true, phase: 3 })
        }

        if (url.pathname === '/api/profile' && request.method === 'GET') {
          const row = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?1').bind(userId).first<Row>()
          return json(profileFromRow(row))
        }
        if (url.pathname === '/api/profile' && request.method === 'PUT') {
          const p = await readJson(request)
          if (!p) return bad('invalid_json', '请求内容不是合法的 JSON')
          // Height and weight are required: defaulting them to one user's
          // numbers would give every account the wrong BMI.
          if (p.height_cm == null || p.weight_kg == null) {
            return json({ error: 'missing_fields', message: '身高和体重必填' }, 400)
          }
          // 服务端逐字段校验（最终审核报告 P1-19），非法返回 400。
          if (!isNumInRange(p.height_cm, 100, 250)) return bad('invalid_field', 'height_cm 须为 100–250 的数字')
          if (!isNumInRange(p.weight_kg, 20, 300)) return bad('invalid_field', 'weight_kg 须为 20–300 的数字')
          const checks: (Response | null)[] = [
            checkOptInt(p, 'age', 1, 120),
            checkOptInt(p, 'pain_now', 0, 10),
            checkOptInt(p, 'single_leg_seconds', 0, 300),
            checkOptInt(p, 'single_leg_left', 0, 300),
            checkOptInt(p, 'single_leg_right', 0, 300),
            checkOptInt(p, 'side_plank_seconds', 0, 300),
            checkOptInt(p, 'wall_sit_seconds', 0, 300),
            checkOptNum(p, 'waist_cm', 40, 200),
            checkOptNum(p, 'sleep_hours', 0, 24),
            checkOptNum(p, 'sitting_hours', 0, 24),
            checkOptInt(p, 'daily_steps', 0, 100000),
            checkOptStr(p, 'equipment', 100),
            checkOptStr(p, 'focus', 100),
            checkOptStrArray(p, 'red_flag_items', 100),
            checkOptStrArray(p, 'yellow_flags', 100),
            checkOptNum(p, 'waist_target_cm', 40, 200),
          ]
          for (const c of checks) if (c) return c
          if (p.sleep_quality != null && !['好', '一般', '差'].includes(String(p.sleep_quality))) {
            return bad('invalid_field', 'sleep_quality 须为 好/一般/差 之一')
          }
          if (p.waist_target_mode != null && !['below94', 'minus3'].includes(String(p.waist_target_mode))) {
            return bad('invalid_field', 'waist_target_mode 须为 below94/minus3 之一')
          }
          // 不再接受客户端直接改阶段（最终审核报告 P0-4）：忽略 body 里的
          // current_phase / recommended_phase。已有档案保留原阶段；
          // 首次建档强制 1 / 1。升级只走 POST /api/profile/phase。
          const existing = await env.DB.prepare(
            'SELECT current_phase, recommended_phase FROM profiles WHERE user_id = ?1',
          )
            .bind(userId)
            .first<Row>()
          const currentPhase = existing ? Number(existing.current_phase) : 1
          const recommendedPhase = existing ? Number(existing.recommended_phase) : 1
          await env.DB.prepare(
            `INSERT INTO profiles (user_id, age, height_cm, weight_kg, waist_cm, sleep_hours, sitting_hours, daily_steps, pain_now, leg_pain, leg_numbness, leg_weakness, red_flag, single_leg_seconds, wall_sit_seconds, daily_minutes, equipment, focus, recommended_phase, current_phase, start_date, red_flag_items, single_leg_left, single_leg_right, side_plank_seconds, smoking, diabetes, annular_defect, recurrence, heart_disease, hypertension, medication, exercise_chest_pain, doctor_assessed_leg, sleep_quality, yellow_flags, waist_target_cm, waist_target_mode, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38, datetime('now'))
             ON CONFLICT(user_id) DO UPDATE SET age=excluded.age, height_cm=excluded.height_cm, weight_kg=excluded.weight_kg, waist_cm=excluded.waist_cm, sleep_hours=excluded.sleep_hours, sitting_hours=excluded.sitting_hours, daily_steps=excluded.daily_steps, pain_now=excluded.pain_now, leg_pain=excluded.leg_pain, leg_numbness=excluded.leg_numbness, leg_weakness=excluded.leg_weakness, red_flag=excluded.red_flag, single_leg_seconds=excluded.single_leg_seconds, wall_sit_seconds=excluded.wall_sit_seconds, daily_minutes=excluded.daily_minutes, equipment=excluded.equipment, focus=excluded.focus, recommended_phase=excluded.recommended_phase, current_phase=excluded.current_phase, start_date=excluded.start_date, red_flag_items=excluded.red_flag_items, single_leg_left=excluded.single_leg_left, single_leg_right=excluded.single_leg_right, side_plank_seconds=excluded.side_plank_seconds, smoking=excluded.smoking, diabetes=excluded.diabetes, annular_defect=excluded.annular_defect, recurrence=excluded.recurrence, heart_disease=excluded.heart_disease, hypertension=excluded.hypertension, medication=excluded.medication, exercise_chest_pain=excluded.exercise_chest_pain, doctor_assessed_leg=excluded.doctor_assessed_leg, sleep_quality=excluded.sleep_quality, yellow_flags=excluded.yellow_flags, waist_target_cm=excluded.waist_target_cm, waist_target_mode=excluded.waist_target_mode, updated_at=datetime('now')`,
          )
            .bind(
              userId,
              p.age ?? null,
              p.height_cm,
              p.weight_kg,
              p.waist_cm ?? null,
              p.sleep_hours ?? null,
              p.sitting_hours ?? null,
              p.daily_steps ?? null,
              p.pain_now ?? 0,
              p.leg_pain ? 1 : 0,
              p.leg_numbness ? 1 : 0,
              p.leg_weakness ? 1 : 0,
              p.red_flag ? 1 : 0,
              p.single_leg_seconds ?? null,
              p.wall_sit_seconds ?? null,
              p.daily_minutes ?? null,
              p.equipment ?? '',
              p.focus ?? '',
              recommendedPhase,
              currentPhase,
              p.start_date ?? null,
              JSON.stringify(Array.isArray(p.red_flag_items) ? p.red_flag_items : []),
              p.single_leg_left ?? null,
              p.single_leg_right ?? null,
              p.side_plank_seconds ?? null,
              p.smoking ? 1 : 0,
              p.diabetes ? 1 : 0,
              p.annular_defect ? 1 : 0,
              p.recurrence ? 1 : 0,
              p.heart_disease ? 1 : 0,
              p.hypertension ? 1 : 0,
              p.medication ? 1 : 0,
              p.exercise_chest_pain ? 1 : 0,
              p.doctor_assessed_leg ? 1 : 0,
              p.sleep_quality ?? null,
              JSON.stringify(Array.isArray(p.yellow_flags) ? p.yellow_flags : []),
              p.waist_target_cm ?? null,
              p.waist_target_mode ?? null,
            )
            .run()
          const row = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?1').bind(userId).first<Row>()
          return json(profileFromRow(row))
        }
        if (url.pathname === '/api/check-ins' && request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT * FROM check_ins WHERE user_id = ?1 ORDER BY date ASC',
          )
            .bind(userId)
            .all<Row>()
          return json(results.map(checkInFromRow))
        }
        if (url.pathname === '/api/check-ins' && request.method === 'POST') {
          const c = await readJson(request)
          if (!c) return bad('invalid_json', '请求内容不是合法的 JSON')
          // date 缺失/非法一律 400，不走到 500。
          if (!validDate(c.date)) return bad('invalid_date', '日期不对或晚于今天')
          // pain 为 null 视为缺失 → 400（前端 pain 未选时禁止保存）。
          if (!isIntInRange(c.pain, 0, 10)) return bad('invalid_field', 'pain 须为 0–10 的整数')
          const checks: (Response | null)[] = [
            checkOptInt(c, 'leg_pain', 0, 10),
            checkOptInt(c, 'peak_pain', 0, 10),
            checkOptInt(c, 'walking_minutes', 0, 600),
            checkOptInt(c, 'micro_breaks', 0, 50),
            checkOptNum(c, 'morning_vs_baseline', -10, 10),
            checkOptNum(c, 'sleep_hours', 0, 24),
            checkOptNum(c, 'sitting_hours', 0, 24),
            checkOptStr(c, 'note', 500),
            checkOptStrArray(c, 'red_flag_screen', 100),
          ]
          for (const chk of checks) if (chk) return chk
          if (c.pain_location != null && !['腰部', '臀部', '大腿', '膝以下'].includes(String(c.pain_location))) {
            return bad('invalid_field', 'pain_location 须为 腰部/臀部/大腿/膝以下 之一')
          }
          await env.DB.prepare(
            `INSERT INTO check_ins (user_id, date, morning, micro_breaks, core, strength, walking_minutes, bedtime_stretch, pain, leg_pain, pain_location, peak_pain, relieved_30min, new_leg_symptoms, morning_vs_baseline, diet_veg_first, diet_no_sugary, sleep_hours, sitting_hours, red_flag_screen, note)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)
             ON CONFLICT(user_id, date) DO UPDATE SET morning=excluded.morning, micro_breaks=excluded.micro_breaks, core=excluded.core, strength=excluded.strength, walking_minutes=excluded.walking_minutes, bedtime_stretch=excluded.bedtime_stretch, pain=excluded.pain, leg_pain=excluded.leg_pain, pain_location=excluded.pain_location, peak_pain=excluded.peak_pain, relieved_30min=excluded.relieved_30min, new_leg_symptoms=excluded.new_leg_symptoms, morning_vs_baseline=excluded.morning_vs_baseline, diet_veg_first=excluded.diet_veg_first, diet_no_sugary=excluded.diet_no_sugary, sleep_hours=excluded.sleep_hours, sitting_hours=excluded.sitting_hours, red_flag_screen=excluded.red_flag_screen, note=excluded.note`,
          )
            .bind(
              userId,
              c.date,
              c.morning ? 1 : 0,
              c.micro_breaks ?? 0,
              c.core ? 1 : 0,
              c.strength ? 1 : 0,
              c.walking_minutes ?? 0,
              c.bedtime_stretch ? 1 : 0,
              c.pain,
              c.leg_pain ?? null,
              c.pain_location ?? null,
              c.peak_pain ?? null,
              c.relieved_30min == null ? null : c.relieved_30min ? 1 : 0,
              c.new_leg_symptoms ? 1 : 0,
              c.morning_vs_baseline ?? null,
              c.diet_veg_first ? 1 : 0,
              c.diet_no_sugary ? 1 : 0,
              c.sleep_hours ?? null,
              c.sitting_hours ?? null,
              JSON.stringify(Array.isArray(c.red_flag_screen) ? c.red_flag_screen : []),
              c.note ?? '',
            )
            .run()
          return json({ ok: true })
        }
        if (url.pathname === '/api/waist' && request.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT date, waist_cm FROM waist_entries WHERE user_id = ?1 ORDER BY date ASC').bind(userId).all<Row>()
          return json(results)
        }
        if (url.pathname === '/api/waist' && request.method === 'POST') {
          const e = await readJson(request)
          if (!e) return bad('invalid_json', '请求内容不是合法的 JSON')
          if (!validDate(e.date)) return bad('invalid_date', '日期不对或晚于今天')
          if (!isNumInRange(e.waist_cm, 40, 200)) return bad('invalid_field', 'waist_cm 须为 40–200 的数字')
          await env.DB.prepare(
            `INSERT INTO waist_entries (user_id, date, waist_cm) VALUES (?1, ?2, ?3)
             ON CONFLICT(user_id, date) DO UPDATE SET waist_cm=excluded.waist_cm`,
          )
            .bind(userId, e.date, e.waist_cm)
            .run()
          return json({ ok: true })
        }
        return json({ error: 'not found' }, 404)
      } catch {
        // Never leak internals (e.g. D1 error text revealing table names).
        return json({ error: 'server_error', message: '服务器出错了，请稍后重试' }, 500)
      }
    }

    // The built HTML references /Resumetraining/assets/... because the Vite
    // base is set for the GitHub Pages deployment. The Worker serves the
    // same files at /assets/..., so strip the prefix before fetching.
    // Without this, the asset lookup 404s and the SPA fallback returns
    // index.html with a text/html MIME type, which browsers reject for
    // module scripts.
    const assetUrl = new URL(request.url)
    if (assetUrl.pathname.startsWith('/Resumetraining/')) {
      assetUrl.pathname = assetUrl.pathname.slice('/Resumetraining'.length)
    }
    const asset = await env.ASSETS.fetch(new Request(assetUrl, request))
    if (asset.status !== 404) return asset
    return env.ASSETS.fetch(new Request(new URL('/', request.url), request))
  },
}
