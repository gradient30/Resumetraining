import { useState } from 'react'
import type { WaistEntry } from '../api'
import { todayStr } from '../api'

export default function WaistLog({ entries, synced, onSave }: { entries: WaistEntry[]; synced?: boolean; onSave: (e: WaistEntry) => Promise<void> }) {
  const [val, setVal] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const handleSave = async () => {
    if (!val) return
    setSaving(true)
    setSaveError(false)
    try {
      await onSave({ date: todayStr(), waist_cm: Number(val) })
      setSaved(true)
      setVal('')
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }
  const first = entries[0]?.waist_cm
  const last = entries[entries.length - 1]?.waist_cm
  const delta = first != null && last != null ? (last - first).toFixed(1) : null
  // Simple SVG trend chart, 94 / 102 cm reference lines.
  const pts = entries.map((e, i) => ({ x: 20 + (i * 300) / Math.max(1, entries.length - 1), y: 150 - ((e.waist_cm - 80) / 30) * 130, v: e.waist_cm }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const y94 = 150 - ((94 - 80) / 30) * 130
  const y102 = 150 - ((102 - 80) / 30) * 130
  return (
    <div className="card">
      <h2>腰围记录</h2>
      <p className="muted">每周同一时间、肚脐同一位置量：软尺放肚脐一圈，呼气后放松着量，站直别收腹。只看腰围，不只看体重；局部减脂做不到，目标是腰围慢慢下来。男性参考线：94 cm 风险升高，102 cm 明显升高（NHS）。腰围变化通常需要数周。</p>
      {entries.length > 0 && last != null && (
        <p>最新：<strong>{last} cm</strong>{delta !== null && <> · 较首次 {Number(delta) > 0 ? '+' : ''}{delta} cm</>}</p>
      )}
      {entries.length > 1 && (
        <svg viewBox="0 0 340 170" style={{ width: '100%' }} role="img" aria-label="腰围趋势图">
          <line x1="10" y1={y94} x2="330" y2={y94} stroke="#d97706" strokeDasharray="5 3" />
          <text x="12" y={y94 - 4} fontSize="10" fill="#d97706">94 cm</text>
          <line x1="10" y1={y102} x2="330" y2={y102} stroke="#dc2626" strokeDasharray="5 3" />
          <text x="12" y={y102 - 4} fontSize="10" fill="#dc2626">102 cm</text>
          <path d={line} fill="none" stroke="#e60012" strokeWidth="2.5" />
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#e60012" />)}
        </svg>
      )}
      <label>今天腰围（cm）</label>
      <input type="number" step="0.1" value={val} onChange={(e) => { setVal(e.target.value); setSaved(false); setSaveError(false) }} placeholder="例如 93.2" />
      <button className="primary" disabled={!val || saving} onClick={handleSave}>{saving ? '保存中…' : saved ? (synced ? '已同步到云端 ✓' : '已保存在本机 ✓') : '记一笔'}</button>
      {saveError && <p className="danger">保存失败，请检查网络后重试，刚才的数字还在。</p>}
      {saved && <p className="muted">{synced ? '已保存到你的账号，换设备登录也能看到。' : '仅保存在当前浏览器里（Pages 体验版没有服务器同步），换设备或清缓存会丢失。'}</p>}
      {entries.length > 0 && (
        <ul>{[...entries].reverse().slice(0, 8).map((e) => <li key={e.date}>{e.date} · {e.waist_cm} cm</li>)}</ul>
      )}
    </div>
  )
}
