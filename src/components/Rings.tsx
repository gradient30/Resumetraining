// 活力三环 — Huawei Health style activity rings (SVG only, no images).
// Ring 1 晨间颈肩 (red), Ring 2 核心力量 (orange), Ring 3 步行 (green).
// Each ring is 0-100%; a ring is "lit" when its task is done.
// Walking target is the per-week daily dose from v2 §六 (22→40 min/day),
// passed in from App as `walkTarget` — no longer a fixed 30 min/day.
// The core ring is still lit by `core` only; strength is tracked separately
// in the task list (App.tsx) and does not enter the three rings.

export interface RingState {
  morning: boolean
  core: boolean
  walkingMinutes: number
  /** 当日阶段剂量（分钟），由 App 按周数传入；未传时默认 30 分钟。 */
  walkTarget?: number
}

function Ring({
  r,
  pct,
  color,
  gradientId,
}: {
  r: number
  pct: number
  color: string
  gradientId: string
}) {
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, pct))
  return (
    <>
      <circle cx="110" cy="110" r={r} fill="none" stroke="#f0f0f2" strokeWidth="13" />
      <circle
        cx="110"
        cy="110"
        r={r}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray={`${c * clamped} ${c}`}
        transform="rotate(-90 110 110)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <circle cx="110" cy="110" r={r} fill="none" stroke={color} strokeWidth="0" />
    </>
  )
}

export default function ActivityRings({ morning, core, walkingMinutes, walkTarget = 30 }: RingState) {
  const target = walkTarget > 0 ? walkTarget : 30
  const walkPct = Math.min(1, walkingMinutes / target)
  const walkDone = walkingMinutes >= target
  const doneCount = (morning ? 1 : 0) + (core ? 1 : 0) + (walkDone ? 1 : 0)
  const allDone = doneCount === 3

  return (
    <div className="card rings-card">
      <div className="rings-head">
        <h2>活力三环</h2>
        <span className="chip chip-red">{allDone ? '🎉 点亮三环' : `已完成 ${doneCount}/3 环`}</span>
      </div>
      <div className="rings-wrap">
        <svg viewBox="0 0 220 220" className="rings-svg" role="img" aria-label="活力三环">
          <defs>
            <linearGradient id="ring-red" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff5a5a" />
              <stop offset="100%" stopColor="#e60012" />
            </linearGradient>
            <linearGradient id="ring-orange" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffb020" />
              <stop offset="100%" stopColor="#ff7a1a" />
            </linearGradient>
            <linearGradient id="ring-green" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#00b578" />
            </linearGradient>
          </defs>
          <Ring r={86} pct={morning ? 1 : 0} color="#e60012" gradientId="ring-red" />
          <Ring r={64} pct={core ? 1 : 0} color="#ff7a1a" gradientId="ring-orange" />
          <Ring r={42} pct={walkPct} color="#00b578" gradientId="ring-green" />
        </svg>
        <div className="rings-center">
          <div className="rings-center-num">{doneCount}<span>/3</span></div>
          <div className="rings-center-label">{allDone ? '三环点亮' : '环已点亮'}</div>
        </div>
      </div>
      <div className="ring-legend">
        <div className={`legend-item ${morning ? 'done' : ''}`}>
          <span className="legend-dot" style={{ background: '#e60012' }} />
          <div><strong>晨间颈肩</strong><span>{morning ? '已完成' : '待完成 · 5–7 分钟'}</span></div>
          <b>{morning ? '100%' : '0%'}</b>
        </div>
        <div className={`legend-item ${core ? 'done' : ''}`}>
          <span className="legend-dot" style={{ background: '#ff7a1a' }} />
          <div><strong>核心力量</strong><span>{core ? '已完成' : '待完成 · 15–20 分钟'}</span></div>
          <b>{core ? '100%' : '0%'}</b>
        </div>
        <div className={`legend-item ${walkDone ? 'done' : ''}`}>
          <span className="legend-dot" style={{ background: '#00b578' }} />
          <div><strong>步行</strong><span>{`已走 ${walkingMinutes} 分钟 · 目标 ${target} 分钟`}</span></div>
          <b>{Math.round(walkPct * 100)}%</b>
        </div>
      </div>
      {allDone && <p className="rings-celebrate">🎉 今天三环全部点亮，坚持得很好，明天继续保持这个节奏。</p>}
    </div>
  )
}
