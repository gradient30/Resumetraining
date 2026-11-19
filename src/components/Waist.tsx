import { useState } from 'react'
import type { WaistEntry } from '../api'
import { todayStr } from '../api'

type WaistTarget = { mode: 'below94' | 'minus3'; base: number }
const LS_TARGET = 'rt_waist_target_v1'

function loadTarget(): WaistTarget | null {
  try {
    const raw = localStorage.getItem(LS_TARGET)
    if (!raw) return null
    const t = JSON.parse(raw) as WaistTarget
    if (t && (t.mode === 'below94' || t.mode === 'minus3') && typeof t.base === 'number') return t
    return null
  } catch {
    return null
  }
}

// y 值钳制在绘图区内（viewBox 高 170，留 8px 上下边距）。
const clampY = (v: number) => Math.min(162, Math.max(8, 150 - ((v - 80) / 30) * 130))

export default function WaistLog({ entries, synced, onSave }: { entries: WaistEntry[]; synced?: boolean; onSave: (e: WaistEntry) => Promise<void> }) {
  const [val, setVal] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [inputError, setInputError] = useState('')
  const [target, setTarget] = useState<WaistTarget | null>(() => loadTarget())

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]?.waist_cm
  const last = sorted[sorted.length - 1]?.waist_cm
  const delta = first != null && last != null ? (last - first).toFixed(1) : null

  const handleSave = async () => {
    if (!val) return
    const v = Number(val)
    if (!Number.isFinite(v) || v < 50 || v > 150) {
      setInputError('腰围应在 50–150 cm 之间，请检查一下再保存（超出范围不保存）。')
      return
    }
    setInputError('')
    setSaving(true)
    setSaveError(false)
    try {
      await onSave({ date: todayStr(), waist_cm: v })
      setSaved(true)
      setVal('')
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  const saveTarget = (mode: 'below94' | 'minus3') => {
    if (first == null) return
    const t: WaistTarget = { mode, base: first }
    try { localStorage.setItem(LS_TARGET, JSON.stringify(t)) } catch { /* storage unavailable — ignore */ }
    setTarget(t)
  }
  const targetValue = target == null ? null : target.mode === 'below94' ? 94 : target.base - 3
  const targetY = targetValue == null ? null : clampY(targetValue)

  // 横轴按真实日期间距；单点 / 同日时等距兜底。
  const times = sorted.map((e) => new Date(e.date + 'T00:00:00').getTime())
  const span = times.length ? times[times.length - 1] - times[0] : 0
  const pts = sorted.map((e, i) => ({
    x: span > 0 ? 20 + ((times[i] - times[0]) / span) * 300 : 20 + (i * 300) / Math.max(1, sorted.length - 1),
    y: clampY(e.waist_cm), v: e.waist_cm, date: e.date,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const y94 = clampY(94)
  const y102 = clampY(102)
  const y90 = clampY(90)

  // 第 4 / 8 周复测提示：按首条日期算周数（仅文案提示，不做新字段）。
  const week = first == null ? 0 : Math.floor((new Date(todayStr() + 'T00:00:00').getTime() - new Date(sorted[0].date + 'T00:00:00').getTime()) / 86400000 / 7) + 1

  return (
    <div className="card">
      <h2>腰围记录</h2>
      <p className="muted">软尺放在最低肋骨与髋骨上缘之间的中点（约肚脐上方），同一时间、同一位点、呼气末放松着量，站直不收腹。量过一次后固定用这个位点，不要在肚脐和中点之间换。只看腰围，不只看体重；局部减脂做不到，目标是腰围慢慢下来。脂肪是全身一起减的，练腹肌是练腹肌下面的肌肉，不直接减上面的脂肪；腰围下来靠全身能量负平衡加上保持肌肉。男性参考线：94 cm 风险升高，102 cm 明显升高（NHS）。腰围变化通常需要数周（4–12 周见变化，不要按单周好坏判断）。</p>
      {entries.length > 0 && last != null && (
        <p>最新：<strong>{last} cm</strong>{delta !== null && <> · 较首次 {Number(delta) > 0 ? '+' : ''}{delta} cm</>}</p>
      )}
      {sorted.length === 1 && first != null && !target && (
        <div className="okbox">
          <strong>第一次量好了，定个目标（二者取先达到者）：</strong>
          <p><button type="button" onClick={() => saveTarget('below94')}>降至 94 cm 以下</button></p>
          <p><button type="button" onClick={() => saveTarget('minus3')}>较首次 −3 cm（{first} cm → {(first - 3).toFixed(1)} cm）</button></p>
        </div>
      )}
      {target != null && targetValue != null && (
        <p className="muted">当前目标：{target.mode === 'below94' ? '降至 94 cm 以下' : `较首次 ${target.base} cm −3 cm，即 ${targetValue.toFixed(1)} cm`}（二者取先达到者）。</p>
      )}
      {week === 4 && (
        <p className="warn">第 4 周到了，复测一次单腿站与靠墙静蹲，与基线并列记录。</p>
      )}
      {week >= 8 && (
        <p className="warn">第 8 周到了，复测一次单腿站与靠墙静蹲，与基线并列记录。</p>
      )}
      {entries.length > 1 && (
        <svg viewBox="0 0 340 170" style={{ width: '100%' }} role="img" aria-label="腰围趋势图">
          <line x1="10" y1={y94} x2="330" y2={y94} stroke="#d97706" strokeDasharray="5 3" />
          <text x="12" y={y94 - 4} fontSize="10" fill="#d97706">94 cm</text>
          <line x1="10" y1={y102} x2="330" y2={y102} stroke="#dc2626" strokeDasharray="5 3" />
          <text x="12" y={y102 - 4} fontSize="10" fill="#dc2626">102 cm</text>
          <line x1="10" y1={y90} x2="330" y2={y90} stroke="#6b7280" strokeDasharray="2 3" />
          <text x="12" y={y90 - 4} fontSize="10" fill="#6b7280">90 cm</text>
          {targetY != null && (
            <>
              <line x1="10" y1={targetY} x2="330" y2={targetY} stroke="#16a34a" strokeDasharray="5 3" />
              <text x="12" y={targetY - 4} fontSize="10" fill="#16a34a">目标 {targetValue?.toFixed(1)} cm</text>
            </>
          )}
          <path d={line} fill="none" stroke="#e60012" strokeWidth="2.5" />
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#e60012" />)}
          <text x="20" y="168" fontSize="10" fill="#8a8a8e">{pts[0]?.date}</text>
          <text x="290" y="168" fontSize="10" fill="#8a8a8e">{pts[pts.length - 1]?.date}</text>
        </svg>
      )}
      <p className="muted">90 cm 东亚人群风险升高参考线（WHO/IDF），非个人诊断。</p>
      <label>今天腰围（cm）</label>
      <input type="number" step="0.1" value={val} onChange={(e) => { setVal(e.target.value); setSaved(false); setSaveError(false); setInputError('') }} placeholder="例如 93.2" />
      {inputError && <p className="danger">{inputError}</p>}
      <button className="primary" disabled={!val || saving} onClick={handleSave}>{saving ? '保存中…' : saved ? (synced ? '已同步到云端 ✓' : '已保存在本机 ✓') : '记一笔'}</button>
      {saveError && <p className="danger">保存失败，请检查网络后重试，刚才的数字还在。</p>}
      {saved && <p className="muted">{synced ? '已保存到你的账号，换设备登录也能看到。' : '仅保存在当前浏览器里（Pages 体验版没有服务器同步），换设备或清缓存会丢失。'}</p>}
      {entries.length > 0 && (
        <ul>{[...sorted].reverse().slice(0, 8).map((e) => <li key={e.date}>{e.date} · {e.waist_cm} cm</li>)}</ul>
      )}
    </div>
  )
}
