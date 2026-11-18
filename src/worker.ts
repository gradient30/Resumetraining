/// <reference types="@cloudflare/workers-types" />
export interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

type Row = Record<string, unknown>

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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
    single_leg_seconds: r.single_leg_seconds ?? null,
    wall_sit_seconds: r.wall_sit_seconds ?? null,
    daily_minutes: r.daily_minutes ?? null,
    equipment: r.equipment ?? '',
    focus: r.focus ?? '',
    recommended_phase: r.recommended_phase,
    current_phase: r.current_phase,
    start_date: r.start_date ?? null,
  }
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
    .bind(token, userId, expires)
    .run()
  return token
}

async function authUserId(request: Request, env: Env): Promise<number | null> {
  const h = request.headers.get('Authorization')
  if (!h || !h.startsWith('Bearer ')) return null
  const token = h.slice(7)
  if (!token) return null
  const row = await env.DB.prepare(
    "SELECT user_id FROM sessions WHERE token = ?1 AND expires_at > datetime('now')",
  )
    .bind(token)
    .first<{ user_id: number }>()
  return row ? row.user_id : null
}

// Simple per-IP rate limit for the auth endpoints, backed by D1.
// `limit` attempts per `windowSeconds` per key; returns false when hit.
async function checkRateLimit(env: Env, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(now - windowSeconds).run()
  const row = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?1').bind(key).first<{ count: number; window_start: number }>()
  if (!row || now - row.window_start >= windowSeconds) {
    await env.DB.prepare('INSERT INTO rate_limits (key, count, window_start) VALUES (?1, 1, ?2) ON CONFLICT(key) DO UPDATE SET count=1, window_start=excluded.window_start').bind(key, now).run()
    return true
  }
  if (row.count >= limit) return false
  await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?1').bind(key).run()
  return true
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
          const body = (await request.json()) as Record<string, unknown>
          const email = String(body.email ?? '').trim().toLowerCase()
          const password = String(body.password ?? '')
          if (!isEmail(email)) return json({ error: 'invalid_email', message: '邮箱格式不对，检查一下' }, 400)
          if (password.length < 6) return json({ error: 'weak_password', message: '密码至少 6 位' }, 400)
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
          // One-time migration claim: rows created before accounts existed
          // carry user_id NULL. The first account to register adopts them.
          // After that the updates match zero rows.
          await env.DB.prepare('UPDATE profiles SET user_id = ?1 WHERE user_id IS NULL').bind(userId).run()
          await env.DB.prepare('UPDATE check_ins SET user_id = ?1 WHERE user_id IS NULL').bind(userId).run()
          await env.DB.prepare('UPDATE waist_entries SET user_id = ?1 WHERE user_id IS NULL').bind(userId).run()
          const token = await createSession(env, userId)
          return json({ token, user: { id: userId, email } })
        }

        if (url.pathname === '/api/auth/login' && request.method === 'POST') {
          const body = (await request.json()) as Record<string, unknown>
          const email = String(body.email ?? '').trim().toLowerCase()
          const password = String(body.password ?? '')
          // Per-email limit, not per-IP: password guessing targets one
          // account, and the caller's IP may rotate (proxies, CGNAT), so
          // an IP-only limit would never accumulate. 10 attempts / 10 min.
          if (!(await checkRateLimit(env, `login:${email}`, 10, 600))) {
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
          const h = request.headers.get('Authorization')
          if (h && h.startsWith('Bearer ')) {
            await env.DB.prepare('DELETE FROM sessions WHERE token = ?1').bind(h.slice(7)).run()
          }
          return json({ ok: true })
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

        if (url.pathname === '/api/profile' && request.method === 'GET') {
          const row = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?1').bind(userId).first<Row>()
          return json(profileFromRow(row))
        }
        if (url.pathname === '/api/profile' && request.method === 'PUT') {
          const p = (await request.json()) as Record<string, unknown>
          // Height and weight are required: defaulting them to one user's
          // numbers would give every account the wrong BMI.
          if (p.height_cm == null || p.weight_kg == null) {
            return json({ error: 'missing_fields', message: '身高和体重必填' }, 400)
          }
          await env.DB.prepare(
            `INSERT INTO profiles (user_id, age, height_cm, weight_kg, waist_cm, sleep_hours, sitting_hours, daily_steps, pain_now, leg_pain, leg_numbness, leg_weakness, red_flag, single_leg_seconds, wall_sit_seconds, daily_minutes, equipment, focus, recommended_phase, current_phase, start_date, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, datetime('now'))
             ON CONFLICT(user_id) DO UPDATE SET age=excluded.age, height_cm=excluded.height_cm, weight_kg=excluded.weight_kg, waist_cm=excluded.waist_cm, sleep_hours=excluded.sleep_hours, sitting_hours=excluded.sitting_hours, daily_steps=excluded.daily_steps, pain_now=excluded.pain_now, leg_pain=excluded.leg_pain, leg_numbness=excluded.leg_numbness, leg_weakness=excluded.leg_weakness, red_flag=excluded.red_flag, single_leg_seconds=excluded.single_leg_seconds, wall_sit_seconds=excluded.wall_sit_seconds, daily_minutes=excluded.daily_minutes, equipment=excluded.equipment, focus=excluded.focus, recommended_phase=excluded.recommended_phase, current_phase=excluded.current_phase, start_date=excluded.start_date, updated_at=datetime('now')`,
          )
            .bind(userId, p.age ?? null, p.height_cm, p.weight_kg, p.waist_cm ?? null, p.sleep_hours ?? null, p.sitting_hours ?? null, p.daily_steps ?? null, p.pain_now ?? 0, p.leg_pain ? 1 : 0, p.leg_numbness ? 1 : 0, p.leg_weakness ? 1 : 0, p.red_flag ? 1 : 0, p.single_leg_seconds ?? null, p.wall_sit_seconds ?? null, p.daily_minutes ?? null, p.equipment ?? '', p.focus ?? '', p.recommended_phase ?? 1, p.current_phase ?? 1, p.start_date ?? null)
            .run()
          const row = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?1').bind(userId).first<Row>()
          return json(profileFromRow(row))
        }
        if (url.pathname === '/api/check-ins' && request.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT date, morning, micro_breaks, core, walking_minutes, bedtime_stretch, pain, note FROM check_ins WHERE user_id = ?1 ORDER BY date ASC').bind(userId).all<Row>()
          return json(results.map((r) => ({ ...r, morning: !!r.morning, core: !!r.core, bedtime_stretch: !!r.bedtime_stretch })))
        }
        if (url.pathname === '/api/check-ins' && request.method === 'POST') {
          const c = (await request.json()) as Record<string, unknown>
          await env.DB.prepare(
            `INSERT INTO check_ins (user_id, date, morning, micro_breaks, core, walking_minutes, bedtime_stretch, pain, note)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(user_id, date) DO UPDATE SET morning=excluded.morning, micro_breaks=excluded.micro_breaks, core=excluded.core, walking_minutes=excluded.walking_minutes, bedtime_stretch=excluded.bedtime_stretch, pain=excluded.pain, note=excluded.note`,
          )
            .bind(userId, c.date, c.morning ? 1 : 0, c.micro_breaks ?? 0, c.core ? 1 : 0, c.walking_minutes ?? 0, c.bedtime_stretch ? 1 : 0, c.pain ?? 0, c.note ?? '')
            .run()
          return json({ ok: true })
        }
        if (url.pathname === '/api/waist' && request.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT date, waist_cm FROM waist_entries WHERE user_id = ?1 ORDER BY date ASC').bind(userId).all<Row>()
          return json(results)
        }
        if (url.pathname === '/api/waist' && request.method === 'POST') {
          const e = (await request.json()) as Record<string, unknown>
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
        return json({ error: '服务器出错了，请稍后重试' }, 500)
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
