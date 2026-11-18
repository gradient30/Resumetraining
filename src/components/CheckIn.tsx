import { useState } from 'react'
import { painFeedback } from '../data'
import type { CheckIn } from '../api'
import { todayStr } from '../api'

export default function CheckInForm({ existing, synced, onSave }: { existing?: CheckIn | null; synced?: boolean; onSave: (c: CheckIn) => Promise<void> }) {
  const [c, setC] = useState<CheckIn>(existing ?? { date: todayStr(), morning: false, micro_breaks: 0, core: false, walking_minutes: 0, bedtime_stretch: false, pain: 0, note: '' })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  // Any edit after a save means the shown record is no longer saved.
  const update = (patch: Partial<CheckIn>) => { setC((prev) => ({ ...prev, ...patch })); setSaved(false); setSaveError(false) }
  const handleSave = async () => {
    setSaving(true)
    setSaveError(false)
    try {
      await onSave(c)
      setSaved(true)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }
  const fb = painFeedback(c.pain)
  const done = [c.morning, c.core, c.bedtime_stretch].filter(Boolean).length + (c.walking_minutes > 0 ? 1 : 0) + (c.micro_breaks > 0 ? 1 : 0)
  return (
    <div className="card">
      <h2>今日打卡 · {c.date}</h2>
      <div className="progress"><div style={{ width: `${(done / 5) * 100}%` }} /></div>
      <p className="muted">完成 {done} / 5 项</p>
      <label><input type="checkbox" style={{ width: 'auto' }} checked={c.morning} onChange={(e) => update({ morning: e.target.checked })} /> 晨间颈肩（5–7 分钟）</label>
      <label>微休息次数（每 30 分钟起来 2–3 分钟）</label>
      <input type="number" min={0} value={c.micro_breaks} onChange={(e) => update({ micro_breaks: Number(e.target.value) || 0 })} />
      <label><input type="checkbox" style={{ width: 'auto' }} checked={c.core} onChange={(e) => update({ core: e.target.checked })} /> 晚间核心 + 力量（15–20 分钟）</label>
      <label>步行分钟</label>
      <input type="number" min={0} value={c.walking_minutes} onChange={(e) => update({ walking_minutes: Number(e.target.value) || 0 })} />
      <label><input type="checkbox" style={{ width: 'auto' }} checked={c.bedtime_stretch} onChange={(e) => update({ bedtime_stretch: e.target.checked })} /> 睡前拉伸 + 呼吸</label>
      <label>今天腰痛几分（0–10 分）</label>
      <div className="painrow">
        {Array.from({ length: 11 }, (_, i) => (
          <button key={i} type="button" className={c.pain === i ? 'sel' : ''} onClick={() => update({ pain: i })}>{i}</button>
        ))}
      </div>
      <div className={fb.tone === 'ok' ? 'okbox' : fb.tone === 'warn' ? 'warn' : 'danger'}>{fb.text}</div>
      <p className="muted">24 小时规则：练时 ≤3 分、30 分钟内缓解、第二天早上不比平时高 1–2 分以上、24 小时内回到原来水平，且没有新腿痛麻木无力，才能加量；每次只改一个变量，每周加不超过 10%。</p>
      <label>备注</label>
      <textarea rows={2} value={c.note} onChange={(e) => update({ note: e.target.value })} placeholder="例如：今天久坐多，脖子有点紧" />
      <button className="primary" disabled={saving} onClick={handleSave}>{saving ? '保存中…' : saved ? (synced ? '已同步到云端 ✓' : '已保存在本机 ✓') : '保存今日打卡'}</button>
      {saveError && <p className="danger">保存失败，请检查网络后重试，刚才的内容还在。</p>}
      {saved && <p className="muted">{synced ? '已保存到你的账号，换设备登录也能看到。' : '仅保存在当前浏览器里（Pages 体验版没有服务器同步），换设备或清缓存会丢失。'}</p>}
    </div>
  )
}
