import { useEffect, useMemo, useState } from 'react'
import { DAILY_SKELETON, EXERCISES, EXERCISE_PHOTOS, PHASES, RED_FLAGS, painFeedback } from './data'
import { clearAuthData, getAuthState, loadCheckIns, loadProfile, loadWaist, logout, onUnauthorized, saveCheckIn, saveProfile, saveWaist, todayStr, weekNumber } from './api'
import * as apiNs from './api'
import type { AuthUser, CheckIn, Profile, WaistEntry } from './api'
import AuthScreen from './components/Auth'
import { ExerciseSvg } from './svg'
import Onboarding from './components/Onboarding'
import CheckInForm from './components/CheckIn'
import WaistLog from './components/Waist'
import Breathing from './components/Breathing'
import ActivityRings from './components/Rings'

// C 组正在同步新增的接口（flushPending / getPendingCount / upgradePhase /
// exportData / deleteAccount / logoutAll / changePassword）在写本文件时尚未
// 落地到 api.ts；这里经 apiAny 以 `as any` 兜底调用，接口落地后无需改动。
// 同理，CheckIn / Profile 的新字段（strength、leg_pain、peak_pain、
// relieved_30min、new_leg_symptoms、morning_vs_baseline、pain_location、
// red_flag_items、单腿站左右、屈膝侧平板、吸烟/糖尿病/心血管/黄旗筛查）
// 在 api.ts 旧类型里还没有，也用 `as any` 读取。
const apiAny = apiNs as unknown as {
  flushPending?: () => Promise<void>
  getPendingCount?: () => Promise<number> | number
  upgradePhase?: () => Promise<{ missing?: string[] } | void>
  exportData?: () => Promise<unknown>
  deleteAccount?: (password: string) => Promise<void>
  logoutAll?: () => Promise<void>
  changePassword?: (oldPassword: string, newPassword: string) => Promise<void>
}

type Tab = 'today' | 'plan' | 'track' | 'profile'

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function dateStr(): string {
  const d = new Date()
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEKDAYS[d.getDay()]}`
}

// 本地日期字符串（YYYY-MM-DD），不用 toISOString（UTC 会在北京时间
// 0:00–7:59 把日期算成前一天）。P1-18。
function localDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// 快走每日剂量（分钟）：v2 §六，按周 +10% 左右递增，22→40 分钟/天。
// 三环、任务勾选的步行阈值统一用这个值，不再用固定 30 分钟。P0-7。
const WALK_MINUTES_BY_WEEK = [22, 24, 26, 28, 31, 34, 37, 40]
function walkTargetFor(week: number): number {
  return WALK_MINUTES_BY_WEEK[Math.min(Math.max(week, 1), 8) - 1]
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// 取一段反馈文案的第一句（按中文分号断句），用于首页洞察与
// painFeedback 共用同一文案源。P1-25。
function firstClause(text: string): string {
  const s = text.split('；')[0].trim()
  return s.endsWith('。') || s.endsWith('！') ? s : `${s}。`
}

// Consecutive check-in days, counting back from today (or yesterday if today is not yet done).
// 日期一律用本地日期字符串比对。P1-18。
function computeStreak(checkIns: CheckIn[]): number {
  const dates = new Set(checkIns.map((c) => c.date))
  const cursor = new Date()
  if (!dates.has(todayStr())) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (dates.has(localDateStr(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// BMI is derived from the logged-in user's own profile, never hardcoded:
// a fixed value would be wrong (and would leak the first user's data)
// for every other account.
function bmiOf(p: Profile | null): number | null {
  if (!p?.height_cm || !p?.weight_kg) return null
  return +(p.weight_kg / (p.height_cm / 100) ** 2).toFixed(1)
}

// 第 3 阶段升级判定（手动确认，v2 §三 / P0-4）：连续 14 个自然日内
// 打卡 ≥12 天，且核心完成 ≥10 天、力量完成 ≥4 天，且这 14 天内每次
// 疼痛 ≤3 分且无新发腿症状，同时周数 ≥5。缺数据（疼痛未填）不给绿灯。
interface Phase3Check {
  eligible: boolean
  missing: string[]
  checkinDays: number
  coreDays: number
  strengthDays: number
  badDays: number
}
function phase3Check(checkIns: CheckIn[], week: number): Phase3Check {
  const start = todayStr(-13)
  const end = todayStr(0)
  const win = checkIns.filter((c) => c.date >= start && c.date <= end)
  const daysIn = (pred: (c: CheckIn) => boolean) =>
    new Set(win.filter(pred).map((c) => c.date)).size
  const checkinDays = new Set(win.map((c) => c.date)).size
  const coreDays = daysIn((c) => c.core)
  const strengthDays = daysIn((c) => !!(c as unknown as { strength?: boolean }).strength)
  const badDays = daysIn((c) => {
    const extra = c as unknown as {
      pain?: number | null
      new_leg_symptoms?: boolean | null
      red_flag_screen?: unknown
    }
    const flagScreen = extra.red_flag_screen
    const flagScreenHit = Array.isArray(flagScreen) ? flagScreen.length > 0 : !!flagScreen
    return extra.pain == null || extra.pain > 3 || extra.new_leg_symptoms === true || flagScreenHit
  })
  const missing: string[] = []
  if (checkinDays < 12) missing.push(`14天内打卡 ${checkinDays}/12 天`)
  if (coreDays < 10) missing.push(`核心完成 ${coreDays}/10 天`)
  if (strengthDays < 4) missing.push(`力量完成 ${strengthDays}/4 天`)
  if (badDays > 0) missing.push(`有 ${badDays} 天疼痛>3分或有新发腿症状`)
  if (week < 5) missing.push(`周数不足5周（当前第 ${week} 周）`)
  return { eligible: missing.length === 0, missing, checkinDays, coreDays, strengthDays, badDays }
}

// v2 §三第 3 阶段手动确认标准全文（计划页第 3 阶段卡片用）。
const PHASE3_RULE_TEXT =
  '第 3 阶段升级为手动确认：连续 14 个自然日内打卡 ≥12 天，且核心完成 ≥10 天、力量完成 ≥4 天，且这 14 天内每次疼痛 ≤3 分且无新发腿症状，同时周数 ≥5。达标时在计划页/首页出现“升级到第 3 阶段”按钮，你点后才升级，升级前显示达标依据。服务端须重新核对打卡记录后才改阶段，不接受客户端直接改阶段。'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [waist, setWaist] = useState<WaistEntry[]>([])
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [localMode, setLocalMode] = useState(false)
  const [serverError, setServerError] = useState(false)
  // 加载失败时显示本地缓存提示（P0-11），而不是静默展示旧数据。
  const [cacheNotice, setCacheNotice] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  // 第 3 阶段升级（P0-4）
  const [upgradeMsg, setUpgradeMsg] = useState('')
  const [upgradeError, setUpgradeError] = useState('')
  const [upgrading, setUpgrading] = useState(false)
  // 档案页：红旗复核 / 导出 / 删除账号 / 退出全部设备 / 修改密码
  const [redFlagMsg, setRedFlagMsg] = useState('')
  const [exportMsg, setExportMsg] = useState('')
  const [exportError, setExportError] = useState('')
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [logoutAllMsg, setLogoutAllMsg] = useState('')
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')

  async function loadAll() {
    try {
      const [p, c, w] = await Promise.all([loadProfile(), loadCheckIns(), loadWaist()])
      setProfile(p)
      setCheckIns(c)
      setWaist(w)
      setCacheNotice(false)
      // 成功后重放离线同步队列（C 组提供），有未同步条目时提示条数。P0-11。
      try {
        if (typeof apiAny.flushPending === 'function') await apiAny.flushPending()
        if (typeof apiAny.getPendingCount === 'function') {
          setPendingCount(await apiAny.getPendingCount())
        }
      } catch {
        /* 同步队列失败不阻塞页面展示；未同步条数下次加载时再提示 */
      }
    } catch {
      // 加载失败：显示的是本地缓存（load* 内部已回退到 localStorage），
      // 明确告诉用户，并提供重试。P0-11。
      setCacheNotice(true)
    }
  }

  function toLogin() {
    // A 401 means the session is dead: drop the token AND the cached data,
    // or the next account on this browser would inherit the old profile.
    clearAuthData()
    setUser(null)
    setProfile(null)
    setCheckIns([])
    setWaist([])
    setLoaded(true)
  }

  useEffect(() => {
    onUnauthorized(() => toLogin())
    ;(async () => {
      const state = await getAuthState()
      if (state.mode === 'authed') {
        setUser(state.user)
        await loadAll()
      } else if (state.mode === 'local') {
        // No Worker behind this build (static Pages): keep the old
        // browser-only behaviour, no login screen.
        setLocalMode(true)
        await loadAll()
      } else if (state.mode === 'error') {
        // The server answered 5xx: show a retry screen instead of
        // silently running in local mode and losing synced data.
        setServerError(true)
      }
      // guest: stay on the login screen, load nothing.
      setLoaded(true)
    })()
  }, [])

  const phase = profile?.current_phase ?? 1
  const week = weekNumber(profile?.start_date)
  const bmi = bmiOf(profile)
  const todayCheckIn = checkIns.find((c) => c.date === todayStr())
  const walkTarget = walkTargetFor(week)
  const last7 = useMemo(() => {
    // 本地日期字符串比较，不用 new Date(c.date)。P1-18。
    const cutoff = todayStr(-6)
    return checkIns.filter((c) => c.date >= cutoff)
  }, [checkIns])
  const last7Minutes = last7.reduce((s, c) => s + c.walking_minutes, 0)
  const phase3 = useMemo(() => phase3Check(checkIns, week), [checkIns, week])
  const streak = useMemo(() => computeStreak(checkIns), [checkIns])

  // Home dashboard data — all derived from existing check-ins / waist entries.
  // pain 可能为 null（未选）；P1-5。
  const todayPain = (todayCheckIn?.pain ?? null) as number | null
  // 新版 painFeedback({pain, legPain, peakPain, relieved30, newLeg, morningDelta, location})，
  // 经 `as any` 调用（data.ts 正在由其他组改为对象参数）。P0-3。
  const todayCheckInAny = todayCheckIn as unknown as {
    leg_pain?: number | null
    peak_pain?: number | null
    relieved_30min?: boolean | null
    new_leg_symptoms?: boolean | null
    morning_vs_baseline?: number | null
    pain_location?: string | null
  } | undefined
  const todayFb =
    todayPain != null
      ? (painFeedback as unknown as (arg: {
          pain: number
          legPain?: number | null
          peakPain?: number | null
          relieved30?: boolean | null
          newLeg?: boolean | null
          morningDelta?: number | null
          location?: string | null
        }) => { tone: 'ok' | 'warn' | 'stop'; text: string })({
          pain: todayPain,
          legPain: todayCheckInAny?.leg_pain ?? null,
          peakPain: todayCheckInAny?.peak_pain ?? null,
          relieved30: todayCheckInAny?.relieved_30min ?? null,
          newLeg: todayCheckInAny?.new_leg_symptoms ?? null,
          morningDelta: todayCheckInAny?.morning_vs_baseline ?? null,
          location: todayCheckInAny?.pain_location ?? null,
        })
      : null
  // 基线：建档时的腰痛分，或近 7 天疼痛中位数，二者取其一并明示。P0-3 / P1-26。
  const last7Pains = last7
    .map((c) => c.pain)
    .filter((p): p is number => p != null)
  const baselinePain = profile?.pain_now ?? median(last7Pains)
  const baselineLabel = profile?.pain_now != null ? '建档时' : '近7天中位数'
  const firstWaist = waist[0]?.waist_cm ?? null
  const lastWaist = waist.length > 0 ? waist[waist.length - 1].waist_cm : null
  const waistDelta = firstWaist != null && lastWaist != null ? +(lastWaist - firstWaist).toFixed(1) : null
  const ringsDone = (todayCheckIn?.morning ? 1 : 0) + (todayCheckIn?.core ? 1 : 0) + ((todayCheckIn?.walking_minutes ?? 0) >= walkTarget ? 1 : 0)
  const strengthDone = !!(todayCheckIn as unknown as { strength?: boolean } | undefined)?.strength
  const tasksDone = [todayCheckIn?.morning, (todayCheckIn?.micro_breaks ?? 0) > 0, todayCheckIn?.core, strengthDone, (todayCheckIn?.walking_minutes ?? 0) >= walkTarget, todayCheckIn?.bedtime_stretch].filter(Boolean).length

  // 首页洞察与 painFeedback 共用同一文案源，不再各写一套。P1-25 / P0-12。
  const insight = useMemo(() => {
    if (todayPain != null && todayPain > 5 && todayFb) return firstClause(todayFb.text)
    if (todayPain != null && todayPain >= 4 && todayFb) return todayFb.text
    if (ringsDone === 3) return '今天三环全部点亮，坚持得很好，明天继续保持这个节奏。'
    if (streak >= 7) return `已经连续打卡 ${streak} 天，腰腹恢复正在稳步推进，继续保持。`
    if (waistDelta != null && waistDelta < 0) return `腰围较首次下降 ${Math.abs(waistDelta)} cm，继续保持先吃菜和蛋白质的饮食习惯。`
    if (last7Minutes >= 150) return `近 7 天步行已达 ${last7Minutes} 分钟，达到每周 150 分钟目标。`
    if (tasksDone === 0) return '今天还没开始，先把晨间颈肩 5 分钟做完，晚上再做核心。'
    return `今天已完成 ${tasksDone} / 6 项，再做 ${6 - tasksDone} 项就能全部完成。`
  }, [todayPain, todayFb, ringsDone, streak, waistDelta, last7Minutes, tasksDone])

  const clover = [
    { icon: '🧣', title: '颈肩', status: todayCheckIn?.morning ? '已完成' : '待完成', done: !!todayCheckIn?.morning, sub: '收下巴 · 肩绕环 · 肩胛收紧' },
    { icon: '💪', title: '腰腹', status: todayCheckIn?.core ? '已完成' : '待完成', done: !!todayCheckIn?.core, sub: '臀桥 · 死虫式 · 鸟狗式' },
    { icon: '🦵', title: '臀腿', status: (todayCheckIn?.walking_minutes ?? 0) >= walkTarget ? '已完成' : '待完成', done: (todayCheckIn?.walking_minutes ?? 0) >= walkTarget, sub: '靠墙静蹲 · 步行 · 单腿站' },
    { icon: '🌀', title: '胸椎', status: todayCheckIn?.bedtime_stretch ? '已完成' : '待完成', done: !!todayCheckIn?.bedtime_stretch, sub: '四点跪旋转 · 猫牛式 · 椅背胸椎伸展' },
  ]

  const tasks = [
    { label: '晨间颈肩', sub: '收下巴 · 肩绕环 · 5–7 分钟', done: !!todayCheckIn?.morning },
    { label: '打断久坐', sub: `微休息 ${todayCheckIn?.micro_breaks ?? 0} 次 · 每 30 分钟起来 2–3 分钟`, done: (todayCheckIn?.micro_breaks ?? 0) > 0 },
    { label: '晚间核心', sub: '臀桥 · 死虫式 · 15–20 分钟', done: !!todayCheckIn?.core },
    { label: '力量日', sub: '坐站 · 臀桥 · 弹力带拉开 · 每周 2 次（建议周二、周六，不连续两天）', done: strengthDone },
    { label: '步行', sub: `已走 ${todayCheckIn?.walking_minutes ?? 0} 分钟 · 今日目标 ${walkTarget} 分钟`, done: (todayCheckIn?.walking_minutes ?? 0) >= walkTarget },
    { label: '睡前拉伸 + 呼吸', sub: '猫牛式 · 髋屈肌 · 3–5 分钟', done: !!todayCheckIn?.bedtime_stretch },
  ]

  // 重新建档时保留原开始日期，不重置周数（v2 §三退阶规则；worker 侧
  // 也保留原 start_date）。只有首次建档（尚无 start_date）才写入新日期。
  async function handleOnboardingDone(p: Profile) {
    const payload = profile?.start_date ? { ...p, start_date: profile.start_date } : p
    const s = await saveProfile(payload)
    setProfile(s)
    setShowOnboarding(false)
  }

  async function handleUpgradePhase() {
    if (!apiAny.upgradePhase) {
      setUpgradeError('升级接口尚未上线，请稍后再试')
      return
    }
    setUpgrading(true)
    setUpgradeMsg('')
    setUpgradeError('')
    try {
      const res = await apiAny.upgradePhase()
      const missing = (res as { missing?: string[] } | undefined)?.missing
      if (missing && missing.length > 0) {
        setUpgradeError(`未达标：${missing.join('、')}`)
        return
      }
      setProfile((prev) => (prev ? { ...prev, current_phase: 3 } : prev))
      setUpgradeMsg('已升级到第3阶段')
    } catch (e) {
      const err = e as { missing?: string[]; message?: string }
      if (err?.missing?.length) setUpgradeError(`未达标：${err.missing.join('、')}`)
      else setUpgradeError(err?.message ? `升级失败：${err.message}` : '升级失败，请检查网络后重试')
    } finally {
      setUpgrading(false)
    }
  }

  const phase3Basis = `已满足：14天内打卡${phase3.checkinDays}天、核心${phase3.coreDays}天、力量${phase3.strengthDays}天、疼痛均≤3分且无新发腿症状`

  // ---- 档案页派生数据（新字段经 `as any` 读取，C 组落地后生效）----
  const profAny = profile as unknown as Record<string, unknown> | null
  const redFlagItems = Array.isArray(profAny?.red_flag_items) ? (profAny.red_flag_items as string[]) : []
  const singleLegLeft = (profAny?.single_leg_left ?? profAny?.single_leg_left_seconds ?? null) as number | null
  const singleLegRight = (profAny?.single_leg_right ?? profAny?.single_leg_right_seconds ?? null) as number | null
  const singleLegDiff =
    singleLegLeft != null && singleLegRight != null ? Math.abs(singleLegLeft - singleLegRight) : null
  // 屈膝侧平板：建档时左右各测 1 次，提交时取较差侧写入 side_plank_seconds。
  const sidePlank = (profAny?.side_plank_seconds ?? null) as number | null
  const sidePlankLeft = (profAny?.side_plank_left_seconds ?? sidePlank) as number | null
  const sidePlankRight = (profAny?.side_plank_right_seconds ?? sidePlank) as number | null
  const screenPositives: string[] = []
  if (profAny?.smoking) screenPositives.push('吸烟')
  if (profAny?.diabetes) screenPositives.push('糖尿病')
  if (profAny?.annular_defect) screenPositives.push('已知环形缺损')
  if (profAny?.recurrence) screenPositives.push('既往复发')
  if (profAny?.heart_disease || profAny?.cardiovascular_disease) screenPositives.push('心血管疾病')
  if (profAny?.hypertension) screenPositives.push('高血压')
  if (profAny?.medication) screenPositives.push('用药')
  if (profAny?.exercise_chest_pain || profAny?.chest_pain) screenPositives.push('运动中胸痛/呼吸困难史')
  const yellowFlags = Array.isArray(profAny?.yellow_flags) ? (profAny.yellow_flags as string[]) : []

  async function handleRedFlagCleared() {
    if (!profile) return
    // 复核仅由用户本人确认，产品不校验医生凭证——已知局限。
    const next = { ...profile, red_flag: false, red_flag_items: [] } as Profile
    const saved = await saveProfile(next)
    setProfile(saved)
    setRedFlagMsg('已记录“已就医排除”。注意：复核仅由你本人确认，产品不校验医生凭证。')
  }

  async function handleExport() {
    if (!apiAny.exportData) {
      setExportError('导出接口尚未上线，请稍后再试')
      return
    }
    setExportError('')
    setExportMsg('')
    try {
      const data = await apiAny.exportData()
      const blob = new Blob([JSON.stringify(data ?? {}, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `resumetraining-export-${todayStr()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportMsg('已导出 JSON 文件')
    } catch (e) {
      setExportError((e as Error)?.message || '导出失败，请检查网络后重试')
    }
  }

  async function handleDeleteAccount() {
    if (!apiAny.deleteAccount) {
      setDeleteError('删除账号接口尚未上线')
      return
    }
    setDeleteError('')
    try {
      await apiAny.deleteAccount(deletePw)
      toLogin()
    } catch (e) {
      setDeleteError((e as Error)?.message || '删除失败，请检查密码后重试')
    }
  }

  async function handleLogoutAll() {
    if (!apiAny.logoutAll) {
      setLogoutAllMsg('退出全部设备接口尚未上线')
      return
    }
    try {
      await apiAny.logoutAll()
      toLogin()
    } catch (e) {
      setLogoutAllMsg((e as Error)?.message || '退出失败，请检查网络后重试')
    }
  }

  async function handleChangePassword() {
    if (newPw.length < 8) {
      setPwError('新密码至少 8 位')
      return
    }
    if (!apiAny.changePassword) {
      setPwError('修改密码接口尚未上线')
      return
    }
    setPwError('')
    setPwMsg('')
    try {
      await apiAny.changePassword(oldPw, newPw)
      setPwMsg('密码已修改，其他设备的会话已吊销，请用新密码重新登录')
      setOldPw('')
      setNewPw('')
    } catch (e) {
      setPwError((e as Error)?.message || '修改失败，请检查旧密码后重试')
    }
  }

  if (!loaded) return <div className="app"><p>加载中…</p></div>

  if (serverError) {
    return (
      <div className="app">
        <div className="card">
          <h2>服务器暂时不可用</h2>
          <p className="muted">刚才没能连上服务器，数据没有加载。请检查网络后重试。</p>
          <button className="primary" onClick={() => window.location.reload()}>重试</button>
        </div>
      </div>
    )
  }

  if (!user && !localMode) {
    return <AuthScreen onDone={async (u) => { setUser(u); await loadAll() }} />
  }

  return (
    <div className="app">
      <header className="hero">
        <p className="hero-date">{dateStr()}</p>
        <h1>{greeting()}，今天也要动起来</h1>
        <p className="hero-sub">久坐办公 · 颈肩腰腹 · 每天动一动</p>
        {profile && (
          <div className="hero-chips">
            <span className="chip">第 {week} 周 / 共 8 周</span>
            <span className="chip">第 {phase} 阶段</span>
            {bmi != null && <span className="chip chip-blue">BMI {bmi} · {profile.weight_kg}kg / {profile.height_cm}cm</span>}
          </div>
        )}
      </header>

      <div className="warn">
        <strong>这不是专家会诊，也不是个人处方。</strong>本方案是对照 NICE NG59、WHO 2023、WHO 2020 与 Cochrane 术后康复综述做的文献审核（2026-11-16），具体组数、次数是按指南原则翻译的实用起点，不是哪条指南直接规定的。请线下康复师做基线评估后再进阶负重动作。
      </div>

      {cacheNotice && (
        <div className="card">
          <p>数据没能刷新，显示的是本地缓存，请检查网络后重试。</p>
          <button className="primary" onClick={() => loadAll()}>重试刷新</button>
        </div>
      )}
      {pendingCount > 0 && (
        <div className="card">
          <p>有 {pendingCount} 条未同步</p>
        </div>
      )}

      {!profile && !skipped && !showOnboarding && (
        <div className="card">
          <h2>第一次使用，先建个人档案</h2>
          <p className="muted">3 步：基础情况 → 症状筛查 → 基线与偏好，填完自动定起始阶段。</p>
          <button className="primary" onClick={() => setShowOnboarding(true)}>开始建档</button>
        </div>
      )}
      {(showOnboarding || (!profile && skipped)) && !profile && (
        <Onboarding
          synced={!localMode}
          onDone={handleOnboardingDone}
          onSkip={() => { setSkipped(true); setShowOnboarding(false) }}
        />
      )}
      {!profile && skipped && (
        <div className="card"><button onClick={() => setShowOnboarding(true)}>重新打开建档向导</button></div>
      )}
      {/* 无档案时训练入口锁定：今日/训练/记录页不渲染，打卡表单也进不去。
          以前无档案也能看到今日页打卡表单，是 P0-1 的绕过路径。 */}
      {!profile && (
        <div className="card">
          <h2>先完成建档，才能开始训练</h2>
          <p className="muted">建档含红旗筛查，是训练前置必做项，不能跳过。完成上面的建档向导后，今日打卡与训练计划才会打开。</p>
        </div>
      )}

      {profile && tab === 'today' && (
        <>
          {/* 周数与阶段脱钩提示：按标准进阶，不按日历进阶。P0-6。 */}
          {week >= 5 && phase === 1 && (
            <div className="card"><p>你已进入第 {week} 周，但仍在第 1 阶段，按标准进阶，不要按日历进阶。</p></div>
          )}
          {week >= 3 && week < 5 && phase === 1 && (
            <div className="card"><p>你已进入第 {week} 周，但仍在第 1 阶段，按标准进阶，不要按日历进阶。</p></div>
          )}
          {/* 8 周后提示。P2-9。 */}
          {week >= 8 && (
            <div className="card">
              <h2>8 周到了</h2>
              <p>8周到了，找线下康复师复评一次，再定下一步；未复评前按维持量继续（核心3–4次/周+力量2次/周+步行≥150分钟/周），不要自行加负重。跑步、重体力、运动恢复须线下康复师分级决定，不要按8周日历自行开始。</p>
            </div>
          )}
          {/* 第 3 阶段升级（手动确认）。P0-4。 */}
          {phase < 3 && phase3.eligible && (
            <div className="card">
              <h2>可以升级到第 3 阶段</h2>
              <p className="muted">{phase3Basis}</p>
              <button className="primary" disabled={upgrading} onClick={handleUpgradePhase}>
                {upgrading ? '升级中…' : `升级到第3阶段（${phase3Basis}）`}
              </button>
              {upgradeMsg && <p className="okbox">{upgradeMsg}</p>}
              {upgradeError && <p className="danger">{upgradeError}</p>}
            </div>
          )}

          <ActivityRings
            morning={!!todayCheckIn?.morning}
            core={!!todayCheckIn?.core}
            walkingMinutes={todayCheckIn?.walking_minutes ?? 0}
            walkTarget={walkTarget}
          />

          <div className="clover-grid">
            {clover.map((c) => (
              <div className="clover-card" key={c.title}>
                <div className="clover-icon">{c.icon}</div>
                <h3>{c.title}</h3>
                <p>{c.sub}</p>
                <span className={`clover-status ${c.done ? 'done' : ''}`}>{c.status}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>今日任务 · 健康生活打卡</h2>
            <div className="progress"><div style={{ width: `${(tasksDone / 6) * 100}%` }} /></div>
            <p className="muted">完成 {tasksDone} / 6 项</p>
            {tasks.map((t) => (
              <div className={`task-row ${t.done ? 'done' : ''}`} key={t.label}>
                <span className="task-check">{t.done ? '✓' : ''}</span>
                <div className="task-text"><strong>{t.label}</strong><span>{t.sub}</span></div>
              </div>
            ))}
            <p className="muted">在下面打卡表单里勾选，任务状态会实时更新。</p>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">腰围</div>
              <div className="big-num">{lastWaist != null ? lastWaist : '—'}<small> cm</small></div>
              <div className="stat-sub">{waistDelta != null ? <>较首次 <b>{waistDelta > 0 ? '+' : ''}{waistDelta} cm</b></> : '今晚量第一次腰围'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">今日疼痛</div>
              <div className="big-num">{todayPain != null ? todayPain : '—'}<small> / 10 分</small></div>
              <div className="stat-sub">{todayFb ? todayFb.tone === 'ok' ? '可以按计划继续' : todayFb.tone === 'warn' ? '建议减量' : '先停练观察' : '打卡时填一下疼痛分'}</div>
              {baselinePain != null && <div className="stat-sub">基线疼痛 {baselinePain} 分（{baselineLabel}）</div>}
            </div>
            <div className="stat-card">
              <div className="stat-label">连续打卡</div>
              <div className="big-num">{streak}<small> 天</small></div>
              <div className="stat-sub">总打卡 <b>{checkIns.length} 天</b></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">近 7 天步行</div>
              <div className="big-num">{last7Minutes}<small> 分钟</small></div>
              <div className="stat-sub">目标每周 <b>≥150 分钟</b> · 已完成 {Math.min(100, Math.round((last7Minutes / 150) * 100))}%</div>
            </div>
          </div>

          <div className="card insight-card">
            <h2>💡 今日洞察</h2>
            <p>{insight}</p>
          </div>

          {profile?.red_flag ? (
            <div className="card danger">
              <h2>训练已锁定</h2>
              <p>建档勾了红旗项目，请先就医。就医排除后，在“我的”页点“已就医排除”复核，才能开始训练。出现大小便变化、会阴麻木、双腿无力加重，立即去急诊。</p>
            </div>
          ) : (
            <CheckInForm
              existing={todayCheckIn}
              synced={!localMode}
              onSave={async (c) => { await saveCheckIn(c); setCheckIns(await loadCheckIns()) }}
            />
          )}
          <div className="card">
            <h2>今天这样安排</h2>
            {DAILY_SKELETON.map((b) => <p key={b.title}><strong>{b.time} · {b.title}</strong><br /><span className="muted">{b.text}</span></p>)}
            <p className="muted">饮食配合：脂肪是全身一起减的，练腹肌是练腹肌下面的肌肉，不直接减上面的脂肪；腰围下来靠全身能量负平衡加上保持肌肉。先吃菜和蛋白质，主食比平时少约1/4，少喝含糖饮料，晚餐清淡、别太晚太撑。不要节食。含糖饮料与酒精都容易让腰围难下来；睡眠不足时食欲与恢复都会受影响，一般建议睡7–9小时。饮食缺口与蛋白质目标需线下医生/营养师定，产品不自行定热量目标。</p>
          </div>
          <Breathing />
          <div className="card">
            <h2>停止信号</h2>
            <p className="muted">出现以下任何一种，停下当天训练并观察，持续不缓解去看医生：腰痛明显加重、疼痛向臀腿放射、腿麻无力加重、动作中刺痛或腰突然“卡住”。</p>
            <p className="danger">出现大小便变化、会阴麻木、双腿无力加重、新发腿麻无力，立即去急诊。</p>
            <button onClick={() => setTab('plan')}>查看完整红旗清单</button>
          </div>
        </>
      )}

      {profile && tab === 'plan' && (
        <>
          <div className="card">
            <h2>8 周阶段</h2>
            {PHASES.map((p) => (
              <div key={p.n} className={`phase-card ${p.n === phase ? 'current' : ''}`}>
                <strong>{p.weeks} · 第 {p.n} 阶段：{p.title}</strong>
                {p.n === phase && <span className="chip">当前阶段</span>}
                <p className="muted">{p.desc}</p>
                {p.n === 3 && (
                  <>
                    <p className="muted">{PHASE3_RULE_TEXT}</p>
                    {phase < 3 && phase3.eligible && (
                      <>
                        <p className="muted">{phase3Basis}</p>
                        <button className="primary" disabled={upgrading} onClick={handleUpgradePhase}>
                          {upgrading ? '升级中…' : `升级到第3阶段（${phase3Basis}）`}
                        </button>
                        {upgradeMsg && <p className="okbox">{upgradeMsg}</p>}
                        {upgradeError && <p className="danger">{upgradeError}</p>}
                      </>
                    )}
                    {phase < 3 && !phase3.eligible && (
                      <p className="muted">还差以下几项，未达第 3 阶段升级标准：{phase3.missing.join('、')}。</p>
                    )}
                    {phase >= 3 && <p className="muted">你已在第 3 阶段。</p>}
                  </>
                )}
              </div>
            ))}
            <p className="muted">8 周后不要停：核心每周 3–4 次、力量每周 2 次、步行每周 ≥150 分钟，作为长期习惯；8 周时找康复师复评下一步。</p>
          </div>
          <div className="card">
            <h2>动作库 · 第 {phase} 阶段剂量</h2>
            <p className="muted">有真人照片的动作照着照片做；还没有照片的先用手绘示意，正在陆续补真人图。不做仰卧起坐、卷腹、负重弯腰、负重扭转、突然发力。</p>
            {EXERCISES.map((ex) => (
              <div className="ex" key={ex.id}>
                <h3>{ex.name} <span className="chip">{ex.group}</span></h3>
                {EXERCISE_PHOTOS[ex.id] ? (
                  <div className="ex-photos">
                    {EXERCISE_PHOTOS[ex.id].map((src, i) => (
                      <img key={i} src={src} alt={`${ex.name}真人示范${EXERCISE_PHOTOS[ex.id].length > 1 ? `（${i + 1}）` : ''}`} loading="lazy" />
                    ))}
                  </div>
                ) : (
                  <ExerciseSvg pose={ex.pose} name={ex.name} />
                )}
                <p><strong>剂量：</strong>{ex.doses[phase - 1]}</p>
                <p className="muted">{ex.tip}</p>
                {ex.caution && <p className="warn">{ex.caution}</p>}
              </div>
            ))}
          </div>
          <div className="card">
            <h2>红旗信号</h2>
            {RED_FLAGS.map((g) => (
              <div key={g.level}><h3>{g.level}</h3><ul>{g.items.map((i) => <li key={i}>{i}</li>)}</ul></div>
            ))}
            <p className="muted">来源：NICE NG59 / NICE CKS 坐骨神经痛指引。怀疑红旗就按紧急处理，不要等确认。</p>
          </div>
        </>
      )}

      {profile && tab === 'track' && (
        <>
          <WaistLog entries={waist} synced={!localMode} onSave={async (e) => { await saveWaist(e); setWaist(await loadWaist()) }} />
          <div className="card">
            <h2>近 7 天统计</h2>
            <p>打卡天数：{last7.length} / 7 天</p>
            <p>步行合计：{last7Minutes} 分钟（目标每周 ≥150 分钟）</p>
            <p>总打卡天数：{checkIns.length} 天</p>
            <div className="progress"><div style={{ width: `${(last7.length / 7) * 100}%` }} /></div>
          </div>
          <div className="card">
            <h2>历史打卡</h2>
            {checkIns.length === 0 ? <p className="muted">还没有记录，今晚量第一次腰围、勾第一次打卡就是起点。</p> : (
              <ul>{[...checkIns].reverse().slice(0, 14).map((c) => (
                <li key={c.date}>{c.date} · 晨间{c.morning ? '✓' : '–'} 微休息{c.micro_breaks}次 核心{c.core ? '✓' : '–'} 步行{c.walking_minutes}分钟 睡前{c.bedtime_stretch ? '✓' : '–'} 疼痛{c.pain != null ? `${c.pain}分` : '未填'}{c.note ? ` · ${c.note}` : ''}</li>
              ))}</ul>
            )}
          </div>
        </>
      )}

      {tab === 'profile' && (
        <div className="card">
          <h2>个人档案</h2>
          {user && (
            <>
              <p>登录账号：{user.email}</p>
              <button onClick={async () => { await logout(); toLogin() }}>退出登录</button>
            </>
          )}
          {profile ? (
            <>
              <p>身高 {profile.height_cm} cm · 体重 {profile.weight_kg} kg{bmi != null ? ` · BMI ${bmi}` : ''}</p>
              <p>年龄 {profile.age ?? '未填'} · 腰围 {profile.waist_cm ?? '未量'} cm · 睡眠 {profile.sleep_hours ?? '未填'} 小时</p>
              <p>久坐 {profile.sitting_hours ?? '未填'} 小时/天 · 日均步数 {profile.daily_steps ?? '未填'}</p>
              <p>当前腰痛 {profile.pain_now ?? 0} 分 · 腿痛{profile.leg_pain ? '有' : '无'} · 腿麻{profile.leg_numbness ? '有' : '无'} · 腿无力{profile.leg_weakness ? '有' : '无'}</p>
              <p>单腿站 {profile.single_leg_seconds ?? '未测'} 秒 · 靠墙静蹲 {profile.wall_sit_seconds ?? '未测'} 秒</p>
              <p>推荐阶段：第 {profile.recommended_phase} 阶段 · 当前阶段：第 {profile.current_phase} 阶段 · 开始日：{profile.start_date ?? '未开始'}</p>
              <h3>基线自测</h3>
              <p>单腿站（左）：{singleLegLeft ?? '未测'}{singleLegLeft != null ? ' 秒' : ''} · 单腿站（右）：{singleLegRight ?? '未测'}{singleLegRight != null ? ' 秒' : ''}</p>
              {singleLegDiff != null && singleLegDiff > 5 && <p className="warn">单腿站左右差 {singleLegDiff} 秒（&gt;5 秒），建议线下评估。</p>}
              <p>屈膝侧平板（较差侧）：{sidePlank ?? '未测'}{sidePlank != null ? ' 秒' : ''}{sidePlankLeft != null && sidePlankRight != null && sidePlankLeft !== sidePlankRight ? `（左 ${sidePlankLeft} 秒 · 右 ${sidePlankRight} 秒）` : ''}</p>
              {screenPositives.length > 0 && (
                <p className="warn">筛查阳性：{screenPositives.join('、')}，建议线下复评。</p>
              )}
              {yellowFlags.length > 0 && (
                <p className="warn">黄旗筛查：勾中 {yellowFlags.length} 项（{yellowFlags.join('、')}）{yellowFlags.length >= 2 ? '，高风险，' : '，'}建议线下复评。</p>
              )}
              {profile.red_flag && (
                <div className="danger">
                  <p>建档红旗：已勾中{redFlagItems.length > 0 ? `（${redFlagItems.join('、')}）` : '（未记录具体项目）'}，已锁定训练，请先就医；就医排除后可点“已就医排除”复核。</p>
                  <button onClick={handleRedFlagCleared}>已就医排除</button>
                  {redFlagMsg && <p>{redFlagMsg}</p>}
                </div>
              )}
              <button onClick={() => setShowOnboarding(true)}>重新评估（重新建档，不会清除已有打卡记录；开始日期不会重置）</button>
              {showOnboarding && <Onboarding synced={!localMode} onDone={handleOnboardingDone} onSkip={() => setShowOnboarding(false)} />}
            </>
          ) : (
            <p className="muted">还没有档案，先完成建档向导。</p>
          )}
          <h3>导出我的数据</h3>
          <button onClick={handleExport}>导出我的数据</button>
          {exportMsg && <p className="muted">{exportMsg}</p>}
          {exportError && <p className="danger">{exportError}</p>}
          <h3>修改密码</h3>
          <label>旧密码</label>
          <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
          <label>新密码（至少 8 位）</label>
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <button onClick={handleChangePassword}>修改密码</button>
          {pwMsg && <p className="muted">{pwMsg}</p>}
          {pwError && <p className="danger">{pwError}</p>}
          <h3>退出全部设备</h3>
          <button onClick={handleLogoutAll}>退出全部设备</button>
          {logoutAllMsg && <p className="danger">{logoutAllMsg}</p>}
          <h3>删除账号</h3>
          <p className="muted">删除不可恢复，将删除该账号的全部档案、打卡和腰围记录。</p>
          {!deleteArmed ? (
            <button onClick={() => { setDeleteArmed(true); setDeleteError('') }}>删除账号</button>
          ) : (
            <>
              <label>输入登录密码确认删除</label>
              <input type="password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
              <button onClick={handleDeleteAccount}>确认删除，不可恢复</button>
              <button onClick={() => { setDeleteArmed(false); setDeletePw(''); setDeleteError('') }}>取消</button>
              {deleteError && <p className="danger">{deleteError}</p>}
            </>
          )}
          <h3>来源</h3>
          <p className="muted">NICE NG59（2016，2026-07-29 更新）、WHO 2023 慢性原发性腰痛指南、WHO 2020 体力活动指南、Cochrane CD003007 椎间盘突出术后康复综述。完整审核见仓库 README。</p>
        </div>
      )}

      <nav className="tabs">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><span className="tab-icon">❤️</span>健康</button>
        <button className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}><span className="tab-icon">🏋️</span>训练</button>
        <button className={tab === 'track' ? 'active' : ''} onClick={() => setTab('track')}><span className="tab-icon">📈</span>记录</button>
        <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><span className="tab-icon">👤</span>我的</button>
      </nav>
    </div>
  )
}
