import { useEffect, useMemo, useState } from 'react'
import { DAILY_SKELETON, EXERCISES, EXERCISE_PHOTOS, PHASES, RED_FLAGS, painFeedback } from './data'
import { clearAuthData, getAuthState, loadCheckIns, loadProfile, loadWaist, logout, onUnauthorized, saveCheckIn, saveProfile, saveWaist, todayStr, weekNumber } from './api'
import type { AuthUser, CheckIn, Profile, WaistEntry } from './api'
import AuthScreen from './components/Auth'
import { ExerciseSvg } from './svg'
import Onboarding from './components/Onboarding'
import CheckInForm from './components/CheckIn'
import WaistLog from './components/Waist'
import Breathing from './components/Breathing'
import ActivityRings from './components/Rings'

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

// Consecutive check-in days, counting back from today (or yesterday if today is not yet done).
function computeStreak(checkIns: CheckIn[]): number {
  const dates = new Set(checkIns.map((c) => c.date))
  const cursor = new Date()
  if (!dates.has(todayStr())) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (dates.has(cursor.toISOString().slice(0, 10))) {
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

  async function loadAll() {
    const [p, c, w] = await Promise.all([loadProfile(), loadCheckIns(), loadWaist()])
    setProfile(p)
    setCheckIns(c)
    setWaist(w)
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
  const last7 = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 6)
    return checkIns.filter((c) => new Date(c.date) >= cutoff)
  }, [checkIns])
  const last7Minutes = last7.reduce((s, c) => s + c.walking_minutes, 0)
  const phase3Eligible = checkIns.length >= 14 && last7.every((c) => c.pain <= 3)
  const streak = useMemo(() => computeStreak(checkIns), [checkIns])

  // Home dashboard data — all derived from existing check-ins / waist entries.
  const todayPain = todayCheckIn?.pain ?? null
  const todayFb = todayPain != null ? painFeedback(todayPain) : null
  const firstWaist = waist[0]?.waist_cm ?? null
  const lastWaist = waist.length > 0 ? waist[waist.length - 1].waist_cm : null
  const waistDelta = firstWaist != null && lastWaist != null ? +(lastWaist - firstWaist).toFixed(1) : null
  const ringsDone = (todayCheckIn?.morning ? 1 : 0) + (todayCheckIn?.core ? 1 : 0) + ((todayCheckIn?.walking_minutes ?? 0) >= 30 ? 1 : 0)
  const tasksDone = [todayCheckIn?.morning, (todayCheckIn?.micro_breaks ?? 0) > 0, todayCheckIn?.core, (todayCheckIn?.walking_minutes ?? 0) > 0, todayCheckIn?.bedtime_stretch].filter(Boolean).length

  const insight = useMemo(() => {
    if (todayPain != null && todayPain > 5) return '今天疼痛超过 5 分，先停练休息，明天再看 24 小时内的变化。'
    if (todayPain != null && todayPain >= 4) return '今天疼痛 4–5 分，建议减量一半，退回上一步的量，别硬撑。'
    if (ringsDone === 3) return '今天三环全部点亮，坚持得很好，明天继续保持这个节奏。'
    if (streak >= 7) return `已经连续打卡 ${streak} 天，腰腹恢复正在稳步推进，继续保持。`
    if (waistDelta != null && waistDelta < 0) return `腰围较首次下降 ${Math.abs(waistDelta)} cm，继续保持先吃菜和蛋白质的饮食习惯。`
    if (last7Minutes >= 150) return `近 7 天步行已达 ${last7Minutes} 分钟，达到每周 150 分钟目标。`
    if (tasksDone === 0) return '今天还没开始，先把晨间颈肩 5 分钟做完，晚上再做核心。'
    return `今天已完成 ${tasksDone} / 5 项，再做 ${5 - tasksDone} 项就能全部完成。`
  }, [todayPain, ringsDone, streak, waistDelta, last7Minutes, tasksDone])

  const clover = [
    { icon: '🧣', title: '颈肩', status: todayCheckIn?.morning ? '已完成' : '待完成', done: !!todayCheckIn?.morning, sub: '收下巴 · 肩绕环 · 肩胛收紧' },
    { icon: '💪', title: '腰腹', status: todayCheckIn?.core ? '已完成' : '待完成', done: !!todayCheckIn?.core, sub: '臀桥 · 死虫式 · 鸟狗式' },
    { icon: '🦵', title: '臀腿', status: (todayCheckIn?.walking_minutes ?? 0) > 0 ? '已完成' : '待完成', done: (todayCheckIn?.walking_minutes ?? 0) > 0, sub: '靠墙静蹲 · 步行 · 单腿站' },
    { icon: '🌀', title: '胸椎', status: todayCheckIn?.bedtime_stretch ? '已完成' : '待完成', done: !!todayCheckIn?.bedtime_stretch, sub: '四点跪旋转 · 猫牛式' },
  ]

  const tasks = [
    { label: '晨间颈肩', sub: '收下巴 · 肩绕环 · 5–7 分钟', done: !!todayCheckIn?.morning },
    { label: '打断久坐', sub: `微休息 ${todayCheckIn?.micro_breaks ?? 0} 次 · 每 30 分钟起来 2–3 分钟`, done: (todayCheckIn?.micro_breaks ?? 0) > 0 },
    { label: '晚间核心 + 力量', sub: '臀桥 · 死虫式 · 15–20 分钟', done: !!todayCheckIn?.core },
    { label: '步行', sub: `已走 ${todayCheckIn?.walking_minutes ?? 0} 分钟 · 目标 30 分钟`, done: (todayCheckIn?.walking_minutes ?? 0) > 0 },
    { label: '睡前拉伸 + 呼吸', sub: '猫牛式 · 髋屈肌 · 3–5 分钟', done: !!todayCheckIn?.bedtime_stretch },
  ]

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
          onDone={async (p) => { const s = await saveProfile(p); setProfile(s); setShowOnboarding(false) }}
          onSkip={() => { setSkipped(true); setShowOnboarding(false) }}
        />
      )}
      {!profile && skipped && (
        <div className="card"><button onClick={() => setShowOnboarding(true)}>重新打开建档向导</button></div>
      )}

      {tab === 'today' && (
        <>
          <ActivityRings
            morning={!!todayCheckIn?.morning}
            core={!!todayCheckIn?.core}
            walkingMinutes={todayCheckIn?.walking_minutes ?? 0}
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
            <div className="progress"><div style={{ width: `${(tasksDone / 5) * 100}%` }} /></div>
            <p className="muted">完成 {tasksDone} / 5 项</p>
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

          <CheckInForm
            existing={todayCheckIn}
            synced={!localMode}
            onSave={async (c) => { await saveCheckIn(c); setCheckIns(await loadCheckIns()) }}
          />
          <div className="card">
            <h2>今天这样安排</h2>
            {DAILY_SKELETON.map((b) => <p key={b.title}><strong>{b.time} · {b.title}</strong><br /><span className="muted">{b.text}</span></p>)}
            <p className="muted">饮食配合：先吃菜和蛋白质，主食比平时少约 1/4，少喝含糖饮料，晚餐清淡、别太晚太撑。不要节食。</p>
          </div>
          <Breathing />
          <div className="card">
            <h2>停止信号</h2>
            <p className="muted">出现以下任何一种，停下当天训练并观察，持续不缓解去看医生：腰痛明显加重、疼痛向臀腿放射、腿麻无力加重、动作中刺痛或腰突然“卡住”。</p>
          </div>
        </>
      )}

      {tab === 'plan' && (
        <>
          <div className="card">
            <h2>8 周阶段</h2>
            {PHASES.map((p) => (
              <div key={p.n} className={`phase-card ${p.n === phase ? 'current' : ''}`}>
                <strong>{p.weeks} · 第 {p.n} 阶段：{p.title}</strong>
                {p.n === phase && <span className="chip">当前阶段</span>}
                <p className="muted">{p.desc}</p>
                {p.n === 3 && !phase3Eligible && <p className="muted">第 3 阶段不靠问卷进入：需要连续两周打卡、疼痛都在 3 分以下，才能升级。</p>}
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

      {tab === 'track' && (
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
                <li key={c.date}>{c.date} · 晨间{c.morning ? '✓' : '–'} 微休息{c.micro_breaks}次 核心{c.core ? '✓' : '–'} 步行{c.walking_minutes}分钟 睡前{c.bedtime_stretch ? '✓' : '–'} 疼痛{c.pain}分{c.note ? ` · ${c.note}` : ''}</li>
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
              <button onClick={() => setShowOnboarding(true)}>重新评估（重新建档）</button>
              {showOnboarding && <Onboarding synced={!localMode} onDone={async (p) => { const s = await saveProfile(p); setProfile(s); setShowOnboarding(false) }} onSkip={() => setShowOnboarding(false)} />}
            </>
          ) : (
            <p className="muted">还没有档案，先完成建档向导。</p>
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
