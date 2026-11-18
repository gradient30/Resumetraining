// API client: D1-backed Worker API is the source of truth when deployed.
// localStorage is only an offline fallback (same keys), so the app still
// works when opened locally without a Worker.
//
// Accounts: the Worker deployment requires a session (email + password).
// Each account only sees its own profile, check-ins and waist entries.
// The static GitHub Pages build has no Worker, so it runs in local mode:
// no login screen, data stays in this browser only.

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
  single_leg_seconds?: number | null
  wall_sit_seconds?: number | null
  daily_minutes?: number | null
  equipment?: string
  focus?: string
  recommended_phase?: number
  current_phase?: number
  start_date?: string | null
}

export interface CheckIn {
  date: string
  morning: boolean
  micro_breaks: number
  core: boolean
  walking_minutes: number
  bedtime_stretch: boolean
  pain: number
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
// 'error': the Worker answered with a 5xx — show a retry screen instead of
// silently falling back to local mode, where saves could be overwritten.
export type AuthState =
  | { mode: 'authed'; user: AuthUser }
  | { mode: 'guest' }
  | { mode: 'local' }
  | { mode: 'error' }

const LS_PROFILE = 'rt_profile_v1'
const LS_CHECKINS = 'rt_checkins_v1'
const LS_WAIST = 'rt_waist_v1'
const LS_TOKEN = 'rt_token_v1'

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

async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const token = getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string> | undefined) || {}),
    }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(path, { ...init, headers })
    if (res.status === 401) {
      unauthorizedHandler?.()
      return null
    }
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function getAuthState(): Promise<AuthState> {
  const token = getToken()
  try {
    const res = await fetch('/api/auth/me', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.status === 401) return { mode: 'guest' }
    if (res.status >= 500) return { mode: 'error' }
    if (!res.ok) return { mode: 'local' }
    const data = (await res.json()) as { id?: unknown; email?: unknown }
    if (!data || typeof data.email !== 'string' || typeof data.id !== 'number') return { mode: 'local' }
    return { mode: 'authed', user: { id: data.id, email: data.email } }
  } catch {
    return { mode: 'local' }
  }
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

export async function loadProfile(): Promise<Profile | null> {
  const remote = await api<Profile>('/api/profile')
  if (remote) {
    ls.set(LS_PROFILE, remote)
    return remote
  }
  return ls.get<Profile | null>(LS_PROFILE, null)
}

export async function saveProfile(p: Profile): Promise<Profile> {
  const authed = !!getToken()
  const saved = await api<Profile>('/api/profile', { method: 'PUT', body: JSON.stringify(p) })
  // Logged in but the server did not take it: say so instead of showing
  // a success message for a save that only landed in this browser.
  if (authed && !saved) throw new Error('保存失败，请检查网络后重试')
  const value = saved ?? p
  ls.set(LS_PROFILE, value)
  return value
}

export async function loadCheckIns(): Promise<CheckIn[]> {
  const remote = await api<CheckIn[]>('/api/check-ins')
  if (remote) {
    ls.set(LS_CHECKINS, remote)
    return remote
  }
  return ls.get<CheckIn[]>(LS_CHECKINS, [])
}

export async function saveCheckIn(c: CheckIn): Promise<void> {
  const authed = !!getToken()
  const saved = await api('/api/check-ins', { method: 'POST', body: JSON.stringify(c) })
  const all = ls.get<CheckIn[]>(LS_CHECKINS, []).filter((x) => x.date !== c.date)
  all.push(c)
  ls.set(LS_CHECKINS, all)
  if (authed && saved === null) throw new Error('保存失败，请检查网络后重试')
}

export async function loadWaist(): Promise<WaistEntry[]> {
  const remote = await api<WaistEntry[]>('/api/waist')
  if (remote) {
    ls.set(LS_WAIST, remote)
    return remote
  }
  return ls.get<WaistEntry[]>(LS_WAIST, [])
}

export async function saveWaist(e: WaistEntry): Promise<void> {
  const authed = !!getToken()
  const saved = await api('/api/waist', { method: 'POST', body: JSON.stringify(e) })
  const all = ls.get<WaistEntry[]>(LS_WAIST, []).filter((x) => x.date !== e.date)
  all.push(e)
  all.sort((a, b) => a.date.localeCompare(b.date))
  ls.set(LS_WAIST, all)
  if (authed && saved === null) throw new Error('保存失败，请检查网络后重试')
}

export function todayStr(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export function weekNumber(startDate: string | null | undefined): number {
  if (!startDate) return 1
  const start = new Date(startDate + 'T00:00:00')
  const now = new Date()
  const days = Math.floor((now.getTime() - start.getTime()) / 86400000)
  return Math.max(1, Math.min(8, Math.floor(days / 7) + 1))
}
