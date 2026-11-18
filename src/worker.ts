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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      try {
        if (url.pathname === '/api/profile' && request.method === 'GET') {
          const row = await env.DB.prepare('SELECT * FROM profiles WHERE id = 1').first<Row>()
          return json(profileFromRow(row))
        }
        if (url.pathname === '/api/profile' && request.method === 'PUT') {
          const p = (await request.json()) as Record<string, unknown>
          await env.DB.prepare(
            `INSERT INTO profiles (id, age, height_cm, weight_kg, waist_cm, sleep_hours, sitting_hours, daily_steps, pain_now, leg_pain, leg_numbness, leg_weakness, red_flag, single_leg_seconds, wall_sit_seconds, daily_minutes, equipment, focus, recommended_phase, current_phase, start_date, updated_at)
             VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET age=excluded.age, height_cm=excluded.height_cm, weight_kg=excluded.weight_kg, waist_cm=excluded.waist_cm, sleep_hours=excluded.sleep_hours, sitting_hours=excluded.sitting_hours, daily_steps=excluded.daily_steps, pain_now=excluded.pain_now, leg_pain=excluded.leg_pain, leg_numbness=excluded.leg_numbness, leg_weakness=excluded.leg_weakness, red_flag=excluded.red_flag, single_leg_seconds=excluded.single_leg_seconds, wall_sit_seconds=excluded.wall_sit_seconds, daily_minutes=excluded.daily_minutes, equipment=excluded.equipment, focus=excluded.focus, recommended_phase=excluded.recommended_phase, current_phase=excluded.current_phase, start_date=excluded.start_date, updated_at=datetime('now')`,
          )
            .bind(p.age ?? null, p.height_cm ?? 180, p.weight_kg ?? 76, p.waist_cm ?? null, p.sleep_hours ?? null, p.sitting_hours ?? null, p.daily_steps ?? null, p.pain_now ?? 0, p.leg_pain ? 1 : 0, p.leg_numbness ? 1 : 0, p.leg_weakness ? 1 : 0, p.red_flag ? 1 : 0, p.single_leg_seconds ?? null, p.wall_sit_seconds ?? null, p.daily_minutes ?? null, p.equipment ?? '', p.focus ?? '', p.recommended_phase ?? 1, p.current_phase ?? 1, p.start_date ?? null)
            .run()
          const row = await env.DB.prepare('SELECT * FROM profiles WHERE id = 1').first<Row>()
          return json(profileFromRow(row))
        }
        if (url.pathname === '/api/check-ins' && request.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT date, morning, micro_breaks, core, walking_minutes, bedtime_stretch, pain, note FROM check_ins ORDER BY date ASC').all<Row>()
          return json(results.map((r) => ({ ...r, morning: !!r.morning, core: !!r.core, bedtime_stretch: !!r.bedtime_stretch })))
        }
        if (url.pathname === '/api/check-ins' && request.method === 'POST') {
          const c = (await request.json()) as Record<string, unknown>
          await env.DB.prepare(
            `INSERT INTO check_ins (date, morning, micro_breaks, core, walking_minutes, bedtime_stretch, pain, note)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(date) DO UPDATE SET morning=excluded.morning, micro_breaks=excluded.micro_breaks, core=excluded.core, walking_minutes=excluded.walking_minutes, bedtime_stretch=excluded.bedtime_stretch, pain=excluded.pain, note=excluded.note`,
          )
            .bind(c.date, c.morning ? 1 : 0, c.micro_breaks ?? 0, c.core ? 1 : 0, c.walking_minutes ?? 0, c.bedtime_stretch ? 1 : 0, c.pain ?? 0, c.note ?? '')
            .run()
          return json({ ok: true })
        }
        if (url.pathname === '/api/waist' && request.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT date, waist_cm FROM waist_entries ORDER BY date ASC').all<Row>()
          return json(results)
        }
        if (url.pathname === '/api/waist' && request.method === 'POST') {
          const e = (await request.json()) as Record<string, unknown>
          await env.DB.prepare(
            `INSERT INTO waist_entries (date, waist_cm) VALUES (?1, ?2)
             ON CONFLICT(date) DO UPDATE SET waist_cm=excluded.waist_cm`,
          )
            .bind(e.date, e.waist_cm)
            .run()
          return json({ ok: true })
        }
        return json({ error: 'not found' }, 404)
      } catch (err) {
        return json({ error: String(err) }, 500)
      }
    }

    // SPA fallback: serve the built asset, falling back to index.html.
    const asset = await env.ASSETS.fetch(request)
    if (asset.status !== 404) return asset
    return env.ASSETS.fetch(new Request(new URL('/', request.url), request))
  },
}
