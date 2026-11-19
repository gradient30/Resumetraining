// API client: D1-backed Worker API is the source of truth when deployed.
// localStorage is only an offline fallback (same keys), so the app still
// works when opened locally without a Worker.
//
// Accounts: the Worker deployment requires a session (email + password).
// Each account only sees its own profile, check-ins and waist entries.
// The static GitHub Pages build has no Worker, so it runs in local mode:
// no login screen, data stays in this browser only.
//
// Offline queue (final audit P0-11): failed saves go into a pending queue
// stored separately from the display cache (rt_pending_*_v1). Loads merge
// pending entries over the server list; flushPending() replays them in
// order when the app starts / network returns.

export interface Profile {
  age?: number | null
  height_cm?: number
  weight_kg?: number
  waist_cm?: number | null
  sleep_hours?: number | null
  sitting_hours?: number | null
  daily_steps?: number | null
  pain_now?: number
  leg_pain?: boolean
  leg_numbness?: boolean
  leg_weakness?: boolean
  red_flag?: boolean
  red_flag_items?: string[]
  single_leg_seconds?: number | null
  single_leg_left?: number | null
  single_leg_right?: number | null
  side_plank_seconds?: number | null
  wall_sit_seconds?: number | null
  daily_minutes?: number | null
  equipment?: string
  focus?: string
  smoking?: boolean
  diabetes?: boolean
  annular_defect?: boolean
  recurrence?: boolean
  heart_disease?: boolean
  hypertension?: boolean
  medication?: boolean
  exercise_chest_pain?: boolean
  doctor_assessed_leg?: boolean
  sleep_quality?: '好' | '一般' | '差'
  yellow_flags?: string[]
  waist_target_cm?: number | null
  waist_target_mode?: 'below94' | 'minus3' | null
  recommended_phase?: number
  current_phase?: number
  start_date?: string | null
}

export interface CheckIn {
  date: string
  morning: boolean
  micro_breaks: number
  core: boolean
  strength?: boolean
  walking_minutes: number
  bedtime_stretch: boolean
  // pain is null when not yet picked; the form must not save a null pain.
  pain: number | null
  leg_pain?: number | null
  pain_location?: '腰部' | '臀部' | '大腿' | '膝以下' | null
  peak_pain?: number | null
  relieved_30min?: boolean | null
  new_leg_symptoms?: boolean
  morning_vs_baseline?: number | null
  diet_veg_first?: boolean
  diet_no_sugary?: boolean
  sleep_hours?: number | null
  sitting_hours?: number | null
  red_flag_screen?: string[]
  note: string
}

export interface WaistEntry {
  date: string
  waist_cm: number
}

export interface AuthUser {
  id: number
  email: string
}

// 'authed': Worker session is valid. 'guest': Worker is present but the
// session is missing or expired, show the login screen. 'local': no Worker
// behind this build (static Pages / offline), use browser storage only.
// 'error': the Worker answered with a 5xx or the network failed — show a
// retry screen instead of silently falling back to local mode, where saves
// could be overwritten.
export type AuthState =
  | { mode: 'authed'; user: AuthUser }
  | { mode: 'guest' }
  | { mode: 'local' }
  | { mode: 'error' }

const LS_PROFILE = 'rt_profile_v1'
const LS_CHECKINS = 'rt_checkins_v1'
const LS_WAIST = 'rt_waist_v1'
const LS_TOKEN = 'rt_token_v1'
// Pending (unsynced) queues, kept apart from the display caches above.
const LS_PENDING_CHECKINS = 'rt_pending_checkins_v1'
const LS_PENDING_WAIST = 'rt_pending_waist_v1'
// Owner of the pending queues (account email). A pending entry is only
// replayed/merged for the account that created it; otherwise user A's
// offline check-in could sync into user B's account after a logout/login
// on the same browser.
const LS_OWNER = 'rt_owner_email_v1'
function pendingOwner(): string | null {
  try {
    return localStorage.getItem(LS_OWNER)
  } catch {
    return null
  }
}
function ownPending<T extends { __owner?: string | null }>(list: T[]): T[] {
  const owner = pendingOwner()
  if (!owner) return list
  return list.filter((x) => !x.__owner || x.__owner === owner)
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(LS_TOKEN)
  } catch {
    return null
  }
}

function setToken(t: string) {
  try {
    localStorage.setItem(LS_TOKEN, t)
  } catch {
    /* storage unavailable — ignore */
  }
}

// Clears the session and the browser-side data cache, so a different
// account on the same browser never sees the previous account's data.
export function clearAuthData() {
  try {
    localStorage.removeItem(LS_TOKEN)
    localStorage.removeItem(LS_PROFILE)
    localStorage.removeItem(LS_CHECKINS)
    localStorage.removeItem(LS_WAIST)
  } catch {
    /* storage unavailable — ignore */
  }
}

let unauthorizedHandler: (() => void) | null = null
export function onUnauthorized(fn: () => void) {
  unauthorizedHandler = fn
}

// Errors carry the HTTP status so callers can tell 401 (session expired)
// apart from 429/5xx/network failure. status 0 means the fetch itself
// failed (network error); status 404 on a /api/* call means no Worker.
export class ApiError extends Error {
  status: number
  constructor(status: number, message?: string) {
    super(message || (status === 0 ? '网络异常' : '请求失败'))
    this.name = 'ApiError'
    this.status = status
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string> | undefined) || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, '网络异常')
  }
  if (res.status === 401) {
    unauthorizedHandler?.()
    throw new ApiError(401, '请先登录')
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null
    throw new ApiError(res.status, data?.message || `请求失败（${res.status}）`)
  }
  return (await res.json()) as T
}

export async function getAuthState(): Promise<AuthState> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch('/api/auth/me', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    // Network failure is an error, not local mode: silently dropping to
    // local would let saves pile up in this browser and never sync.
    return { mode: 'error' }
  }
  if (res.status === 401) return { mode: 'guest' }
  // Only an explicit 404 means "no Worker behind this build" (static
  // Pages): that is the one case that enters local mode.
  if (res.status === 404) return { mode: 'local' }
  if (res.status >= 500) return { mode: 'error' }
  if (!res.ok) return { mode: 'error' }
  const data = (await res.json().catch(() => null)) as { id?: unknown; email?: unknown } | null
  if (!data || typeof data.email !== 'string' || typeof data.id !== 'number') return { mode: 'error' }
  try {
    localStorage.setItem(LS_OWNER, data.email)
  } catch {
    /* ignore */
  }
  return { mode: 'authed', user: { id: data.id, email: data.email } }
}

async function authRequest(path: string, body: unknown): Promise<AuthUser> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as {
    token?: string
    user?: AuthUser
    message?: string
  } | null
  if (!res.ok || !data?.token || !data?.user) {
    throw new Error(data?.message || '出了点问题，再试一次')
  }
  setToken(data.token)
  try {
    localStorage.setItem(LS_OWNER, data.user.email)
  } catch {
    /* ignore */
  }
  return data.user
}

export function login(email: string, password: string): Promise<AuthUser> {
  return authRequest('/api/auth/login', { email, password })
}

export function register(email: string, password: string): Promise<AuthUser> {
  return authRequest('/api/auth/register', { email, password })
}

export async function logout(): Promise<void> {
  const token = getToken()
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    /* logout is best-effort — the local session is cleared below anyway */
  }
  clearAuthData()
}

// POST /api/profile/phase — the server re-checks the last 14 days before
// changing the phase. Throws ApiError(400) with a not_eligible message
// (and a `missing` list in the server body) when requirements are unmet.
export async function upgradePhase(): Promise<{ ok: boolean; phase: number; reason: string }> {
  const data = await api<{ ok: boolean; phase: number }>('/api/profile/phase', { method: 'POST' })
  return { ok: data.ok, phase: data.phase, reason: '' }
}

export async function exportData(): Promise<unknown> {
  return api<unknown>('/api/export')
}

export async function deleteAccount(password: string): Promise<void> {
  await api('/api/account', { method: 'DELETE', body: JSON.stringify({ password }) })
  clearAuthData()
}

export async function logoutAll(): Promise<void> {
  await api('/api/auth/logout-all', { method: 'POST' })
  clearAuthData()
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await api('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  })
}

const ls = {
  get<T>(k: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(k)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v))
    } catch {
      /* storage unavailable — ignore */
    }
  },
}

// Merge pending entries over a base list, keyed by date (pending wins),
// sorted by date. Used when the server list must not wipe unsynced rows.
function mergePending<T extends { date: string }>(base: T[], pending: T[]): T[] {
  const map = new Map<string, T>(base.map((x) => [x.date, x]))
  for (const p of pending) map.set(p.date, p)
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

// Local mode is the no-token case (no Worker): loads fall back to the
// browser cache when the Worker answers 404, and throw otherwise so the
// app can show "数据没能刷新，显示的是本地缓存" with a retry.
function isLocal404(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404
}

export async function loadProfile(): Promise<Profile | null> {
  let remote: Profile | null
  try {
    remote = await api<Profile | null>('/api/profile')
  } catch (e) {
    if (isLocal404(e)) return ls.get<Profile | null>(LS_PROFILE, null)
    throw e
  }
  if (remote) {
    ls.set(LS_PROFILE, remote)
    return remote
  }
  return ls.get<Profile | null>(LS_PROFILE, null)
}

export async function saveProfile(p: Profile): Promise<Profile> {
  const authed = !!getToken()
  let saved: Profile
  try {
    saved = await api<Profile>('/api/profile', { method: 'PUT', body: JSON.stringify(p) })
  } catch (e) {
    // Local mode (no Worker, no token): keep the browser-only save.
    if (!authed) {
      ls.set(LS_PROFILE, p)
      return p
    }
    throw e
  }
  // No pending queue for profile this round (see report): a failed
  // profile save throws and the form keeps its content; nothing is
  // silently queued.
  ls.set(LS_PROFILE, saved)
  return saved
}

export async function loadCheckIns(): Promise<CheckIn[]> {
  const pending = ownPending(ls.get<(CheckIn & { __owner?: string | null })[]>(LS_PENDING_CHECKINS, []))
  let remote: CheckIn[]
  try {
    remote = await api<CheckIn[]>('/api/check-ins')
  } catch (e) {
    if (isLocal404(e)) return mergePending(ls.get<CheckIn[]>(LS_CHECKINS, []), pending)
    throw e
  }
  // Only overwrite the local cache with the server list when the queue
  // is empty; otherwise pending rows (which the server has never seen)
  // would be wiped by the next load.
  if (pending.length === 0) {
    ls.set(LS_CHECKINS, remote)
    return remote
  }
  const merged = mergePending(remote, pending)
  ls.set(LS_CHECKINS, merged)
  return merged
}

function upsertLocalCheckIn(c: CheckIn) {
  const all = ls.get<CheckIn[]>(LS_CHECKINS, []).filter((x) => x.date !== c.date)
  all.push(c)
  ls.set(LS_CHECKINS, all)
}

function enqueuePendingCheckIn(c: CheckIn) {
  const q = ls.get<CheckIn[]>(LS_PENDING_CHECKINS, []).filter((x) => x.date !== c.date)
  q.push({ ...c, __owner: pendingOwner() } as CheckIn)
  ls.set(LS_PENDING_CHECKINS, q)
}

export async function saveCheckIn(c: CheckIn): Promise<void> {
  const authed = !!getToken()
  try {
    await api('/api/check-ins', { method: 'POST', body: JSON.stringify(c) })
  } catch (e) {
    // Local mode (no Worker, no token): browser-only save, no queue.
    if (!authed) {
      upsertLocalCheckIn(c)
      return
    }
    // Online save failed: keep the record in the display cache AND in
    // the pending queue, then throw so the caller can show
    // "保存失败，刚才的内容还在，已加入待同步队列".
    // 400 validation errors are not queued: they would fail forever and
    // block the queue on replay.
    if (!(e instanceof ApiError) || (e.status !== 400 && e.status !== 404)) {
      enqueuePendingCheckIn(c)
    }
    upsertLocalCheckIn(c)
    throw e
  }
  upsertLocalCheckIn(c)
}

export async function loadWaist(): Promise<WaistEntry[]> {
  const pending = ownPending(ls.get<(WaistEntry & { __owner?: string | null })[]>(LS_PENDING_WAIST, []))
  let remote: WaistEntry[]
  try {
    remote = await api<WaistEntry[]>('/api/waist')
  } catch (e) {
    if (isLocal404(e)) return mergePending(ls.get<WaistEntry[]>(LS_WAIST, []), pending)
    throw e
  }
  if (pending.length === 0) {
    ls.set(LS_WAIST, remote)
    return remote
  }
  const merged = mergePending(remote, pending)
  ls.set(LS_WAIST, merged)
  return merged
}

function upsertLocalWaist(e: WaistEntry) {
  const all = ls.get<WaistEntry[]>(LS_WAIST, []).filter((x) => x.date !== e.date)
  all.push(e)
  all.sort((a, b) => a.date.localeCompare(b.date))
  ls.set(LS_WAIST, all)
}

function enqueuePendingWaist(e: WaistEntry) {
  const q = ls.get<WaistEntry[]>(LS_PENDING_WAIST, []).filter((x) => x.date !== e.date)
  q.push({ ...e, __owner: pendingOwner() } as WaistEntry)
  ls.set(LS_PENDING_WAIST, q)
}

export async function saveWaist(e: WaistEntry): Promise<void> {
  const authed = !!getToken()
  try {
    await api('/api/waist', { method: 'POST', body: JSON.stringify(e) })
  } catch (e2) {
    if (!authed) {
      upsertLocalWaist(e)
      return
    }
    if (!(e2 instanceof ApiError) || (e2.status !== 400 && e2.status !== 404)) {
      enqueuePendingWaist(e)
    }
    upsertLocalWaist(e)
    throw e2
  }
  upsertLocalWaist(e)
}

// Replay the pending queues in order (check-ins first, then waist).
// One success removes one entry; the first failure keeps the rest and
// stops the replay. Returns how many entries synced.
export async function flushPending(): Promise<number> {
  let done = 0
  const pendingCheckIns = ownPending(ls.get<(CheckIn & { __owner?: string | null })[]>(LS_PENDING_CHECKINS, []))
  for (const c of pendingCheckIns) {
    try {
      await api('/api/check-ins', { method: 'POST', body: JSON.stringify(c) })
    } catch {
      return done
    }
    ls.set(
      LS_PENDING_CHECKINS,
      ls.get<CheckIn[]>(LS_PENDING_CHECKINS, []).filter((x) => x.date !== c.date),
    )
    done++
  }
  const pendingWaist = ownPending(ls.get<(WaistEntry & { __owner?: string | null })[]>(LS_PENDING_WAIST, []))
  for (const e of pendingWaist) {
    try {
      await api('/api/waist', { method: 'POST', body: JSON.stringify(e) })
    } catch {
      return done
    }
    ls.set(
      LS_PENDING_WAIST,
      ls.get<WaistEntry[]>(LS_PENDING_WAIST, []).filter((x) => x.date !== e.date),
    )
    done++
  }
  return done
}

export function getPendingCount(): number {
  return (
    ownPending(ls.get<(CheckIn & { __owner?: string | null })[]>(LS_PENDING_CHECKINS, [])).length +
    ownPending(ls.get<(WaistEntry & { __owner?: string | null })[]>(LS_PENDING_WAIST, [])).length
  )
}

// Local date (YYYY-MM-DD), not UTC: toISOString() would put a 00:00–07:59
// Beijing check-in on "yesterday" (final audit P1-18).
export function todayStr(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function weekNumber(startDate: string | null | undefined): number {
  if (!startDate) return 1
  const start = new Date(startDate + 'T00:00:00')
  const now = new Date()
  const days = Math.floor((now.getTime() - start.getTime()) / 86400000)
  return Math.max(1, Math.min(8, Math.floor(days / 7) + 1))
}
