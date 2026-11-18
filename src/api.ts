// API client: D1-backed Worker API is the source of truth when deployed.
// localStorage is only an offline fallback (same keys), so the app still
// works when opened locally without a Worker.

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

const LS_PROFILE = 'rt_profile_v1'
const LS_CHECKINS = 'rt_checkins_v1'
const LS_WAIST = 'rt_waist_v1'

async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
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
  const saved = await api<Profile>('/api/profile', { method: 'PUT', body: JSON.stringify(p) })
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
  await api('/api/check-ins', { method: 'POST', body: JSON.stringify(c) })
  const all = ls.get<CheckIn[]>(LS_CHECKINS, []).filter((x) => x.date !== c.date)
  all.push(c)
  ls.set(LS_CHECKINS, all)
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
  await api('/api/waist', { method: 'POST', body: JSON.stringify(e) })
  const all = ls.get<WaistEntry[]>(LS_WAIST, []).filter((x) => x.date !== e.date)
  all.push(e)
  all.sort((a, b) => a.date.localeCompare(b.date))
  ls.set(LS_WAIST, all)
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
