import { useEffect, useRef, useState } from 'react'
import { painFeedback } from '../data'
import type { CheckIn } from '../api'
import { todayStr } from '../api'

// 本地扩展打卡类型：C 组正在给 api.ts 的 CheckIn 加这些可选字段，
// 在此之前用本地类型兜底，保存时再转回 CheckIn。
type CheckInExt = Omit<CheckIn, 'pain'> & {
  pain: number | null
  strength?: boolean
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
}

const SCREEN_ITEMS = ['大小便变化', '会阴/大腿内侧麻木', '双腿无力加重', '新发腿麻无力']
const LOCATIONS = ['腰部', '臀部', '大腿', '膝以下'] as const

function emptyCheckIn(): CheckInExt {
  return {
    date: todayStr(),
    morning: false, micro_breaks: 0, core: false, strength: false,
    walking_minutes: 0, bedtime_stretch: false,
    pain: null, leg_pain: null, pain_location: null, peak_pain: null,
    relieved_30min: null, new_leg_symptoms: false, morning_vs_baseline: null,
    diet_veg_first: false, diet_no_sugary: false,
    sleep_hours: null, sitting_hours: null, red_flag_screen: [], note: '',
  }
}

// 把旧版 / 服务端返回的打卡归一化为新版：缺失的新字段一律回到“未选”。
function normalize(existing: CheckIn): CheckInExt {
  const e = existing as unknown as Partial<CheckInExt>
  return {
    ...emptyCheckIn(),
    ...e,
    date: existing.date,
    pain: typeof e.pain === 'number' ? e.pain : null,
    leg_pain: typeof e.leg_pain === 'number' ? e.leg_pain : null,
    peak_pain: typeof e.peak_pain === 'number' ? e.peak_pain : null,
    morning_vs_baseline: typeof e.morning_vs_baseline === 'number' ? e.morning_vs_baseline : null,
    sleep_hours: typeof e.sleep_hours === 'number' ? e.sleep_hours : null,
    sitting_hours: typeof e.sitting_hours === 'number' ? e.sitting_hours : null,
    red_flag_screen: Array.isArray(e.red_flag_screen) ? e.red_flag_screen : [],
  }
}

export default function CheckInForm({ existing, synced, onSave }: { existing?: CheckIn | null; synced?: boolean; onSave: (c: CheckIn) => Promise<void> }) {
  const [c, setC] = useState<CheckInExt>(() => (existing ? normalize(existing) : emptyCheckIn()))
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  // existing 变化时同步表单（修复 useState 只在挂载时取一次的状态过期问题）。
  // 用内容指纹做守卫：App 每次渲染传了新对象引用也不会把正在填的表冲掉。
  const lastKey = useRef('')
  useEffect(() => {
    const key = JSON.stringify(existing ?? null)
    if (key !== lastKey.current) {
      lastKey.current = key
      setC(existing ? normalize(existing) : emptyCheckIn())
      setSaved(false)
      setSaveError(false)
    }
  }, [existing])
  // Any edit after a save means the shown record is no longer saved.
  const update = (patch: Partial<CheckInExt>) => { setC((prev) => ({ ...prev, ...patch })); setSaved(false); setSaveError(false) }
  const numOrNull = (v: string) => (v === '' ? null : Number(v))

  // 必选疼痛字段：腰痛分、腿痛分、运动中最高疼痛、运动后 30 分钟是否缓解；未选禁止保存。
  const missing: string[] = []
  if (c.pain == null) missing.push('腰痛分')
  if (c.leg_pain == null) missing.push('腿痛分')
  if (c.peak_pain == null) missing.push('运动中最高疼痛')
  if (c.relieved_30min == null) missing.push('运动后 30 分钟是否缓解')
  const canSave = missing.length === 0

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setSaveError(false)
    try {
      await onSave(c as unknown as CheckIn)
      setSaved(true)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  // 新版 painFeedback（对象参数，A 组同步改 data.ts；as any 兜底旧签名未落地前的类型）。
  const fb = canSave
    ? (painFeedback as any)({
        pain: c.pain, legPain: c.leg_pain, peakPain: c.peak_pain,
        relieved30: c.relieved_30min, newLeg: !!c.new_leg_symptoms,
        morningDelta: c.morning_vs_baseline, location: c.pain_location,
      }) as { tone: 'ok' | 'warn' | 'stop'; text: string }
    : null
  const screenHit = (c.red_flag_screen ?? []).length > 0
  const done = [c.morning, c.core, c.strength, c.bedtime_stretch].filter(Boolean).length + (c.walking_minutes > 0 ? 1 : 0) + (c.micro_breaks > 0 ? 1 : 0)

  const painRow = (value: number | null, onPick: (n: number) => void) => (
    <div className="painrow">
      {Array.from({ length: 11 }, (_, i) => (
        <button key={i} type="button" className={value === i ? 'sel' : ''} onClick={() => onPick(i)}>{i}</button>
      ))}
    </div>
  )

  return (
    <div className="card">
      <h2>今日打卡 · {c.date}</h2>
      <div className="progress"><div style={{ width: `${(done / 6) * 100}%` }} /></div>
      <p className="muted">完成 {done} / 6 项</p>
      <label><input type="checkbox" style={{ width: 'auto' }} checked={c.morning} onChange={(e) => update({ morning: e.target.checked })} /> 晨间颈肩（5–7 分钟）</label>
      <label>微休息次数（每 30 分钟起来走 2–5 分钟）</label>
      <input type="number" min={0} value={c.micro_breaks} onChange={(e) => update({ micro_breaks: Number(e.target.value) || 0 })} />
      <label><input type="checkbox" style={{ width: 'auto' }} checked={c.core} onChange={(e) => update({ core: e.target.checked })} /> 晚间核心完成（15–20 分钟）</label>
      <label><input type="checkbox" style={{ width: 'auto' }} checked={!!c.strength} onChange={(e) => update({ strength: e.target.checked })} /> 力量完成（力量日 15–20 分钟，每周 2 次，不连续两天）</label>
      <label>步行分钟</label>
      <input type="number" min={0} value={c.walking_minutes} onChange={(e) => update({ walking_minutes: Number(e.target.value) || 0 })} />
      <label><input type="checkbox" style={{ width: 'auto' }} checked={c.bedtime_stretch} onChange={(e) => update({ bedtime_stretch: e.target.checked })} /> 睡前拉伸 + 呼吸</label>

      <h3>饮食（与腰围趋势并列记录）</h3>
      <label><input type="checkbox" style={{ width: 'auto' }} checked={!!c.diet_veg_first} onChange={(e) => update({ diet_veg_first: e.target.checked })} /> 今日先菜后主食</label>
      <label><input type="checkbox" style={{ width: 'auto' }} checked={!!c.diet_no_sugary} onChange={(e) => update({ diet_no_sugary: e.target.checked })} /> 今日未喝含糖饮料</label>
      <label>昨晚睡眠（小时）</label>
      <input type="number" min={0} step="0.5" value={c.sleep_hours ?? ''} onChange={(e) => update({ sleep_hours: numOrNull(e.target.value) })} placeholder="例如 7.5" />
      <label>今日总久坐约几小时</label>
      <input type="number" min={0} step="0.5" value={c.sitting_hours ?? ''} onChange={(e) => update({ sitting_hours: numOrNull(e.target.value) })} placeholder="例如 9" />

      <h3>疼痛（每次打卡都要填，缺一不可）</h3>
      <label>今天腰痛几分（0–10 分）{c.pain == null && <span className="danger">必选</span>}</label>
      {painRow(c.pain, (n) => update({ pain: n }))}
      <label>今天腿痛几分（0–10 分，与腰痛分开）{c.leg_pain == null && <span className="danger">必选</span>}</label>
      {painRow(c.leg_pain ?? null, (n) => update({ leg_pain: n }))}
      <p className="muted">锚点：0 不痛、1–3 轻微可忍、4–6 中度影响活动、7–10 剧烈难忍。</p>
      <label>疼痛位置（4 选 1）</label>
      <div className="painrow">
        {LOCATIONS.map((loc) => (
          <button key={loc} type="button" className={c.pain_location === loc ? 'sel' : ''} onClick={() => update({ pain_location: loc })}>{loc}</button>
        ))}
      </div>
      {c.pain_location === '膝以下' && (
        <div className="danger">膝以下疼痛按停练逻辑处理：立即停止当天训练；次日不自动恢复原剂量，回到上一阶段剂量；持续不缓解去看医生。</div>
      )}
      <label>运动中最高疼痛（0–10 分）{c.peak_pain == null && <span className="danger">必选</span>}</label>
      {painRow(c.peak_pain ?? null, (n) => update({ peak_pain: n }))}
      <label>运动后 30 分钟是否缓解 {c.relieved_30min == null && <span className="danger">必选</span>}</label>
      <div className="painrow">
        <button type="button" className={c.relieved_30min === true ? 'sel' : ''} onClick={() => update({ relieved_30min: true })}>是</button>
        <button type="button" className={c.relieved_30min === false ? 'sel' : ''} onClick={() => update({ relieved_30min: false })}>否</button>
      </div>
      <label>有无新发腿痛 / 麻木 / 无力</label>
      <div className="painrow">
        <button type="button" className={c.new_leg_symptoms === true ? 'sel' : ''} onClick={() => update({ new_leg_symptoms: true })}>有</button>
        <button type="button" className={c.new_leg_symptoms === false ? 'sel' : ''} onClick={() => update({ new_leg_symptoms: false })}>无</button>
      </div>
      <label>今晨疼痛比平时高几分（负数表示更低，0 表示一样；不填视为缺数据）</label>
      <input type="number" step="0.5" value={c.morning_vs_baseline ?? ''} onChange={(e) => update({ morning_vs_baseline: numOrNull(e.target.value) })} placeholder="例如 0、1、-1" />

      <h3>每日马尾快筛（打卡前先过一遍）</h3>
      {SCREEN_ITEMS.map((item) => (
        <label key={item}><input type="checkbox" style={{ width: 'auto' }} checked={(c.red_flag_screen ?? []).includes(item)} onChange={(e) => update({ red_flag_screen: e.target.checked ? [...(c.red_flag_screen ?? []), item] : (c.red_flag_screen ?? []).filter((x) => x !== item) })} /> {item}</label>
      ))}
      {screenHit && (
        <div className="danger"><strong>立即停止训练，立即去急诊（或打 120），不要等。</strong>你勾了马尾快筛项目：{(c.red_flag_screen ?? []).join('；')}。今日仍可保存这条记录，但不要再练；次日不自动恢复原剂量。</div>
      )}

      {fb ? (
        <div className={fb.tone === 'ok' ? 'okbox' : fb.tone === 'warn' ? 'warn' : 'danger'}>{fb.text}</div>
      ) : (
        <div className="warn">数据不足，暂按减量处理：腰痛分、腿痛分、运动中最高疼痛、运动后 30 分钟是否缓解都要填，才能判断能不能继续。</div>
      )}
      {c.pain != null && c.pain >= 4 && (
        <p className="warn">提示：疼痛 &gt;5 分或连续两天 4–5 分，次日训练表自动显示上一阶段剂量并标注“已退阶”。</p>
      )}
      <p className="muted">24 小时规则：练时 ≤3 分、30 分钟内缓解、第二天早上不比平时高 1–2 分以上、24 小时内回到原来水平，且没有新腿痛麻木无力，才能加量；每次只改一个变量，每周加不超过 10%。</p>
      <label>备注</label>
      <textarea rows={2} value={c.note} onChange={(e) => update({ note: e.target.value })} placeholder="例如：今天久坐多，脖子有点紧" />
      <button className="primary" disabled={saving || !canSave} onClick={handleSave}>{saving ? '保存中…' : saved ? (synced ? '已同步到云端 ✓' : '已保存在本机 ✓') : '保存今日打卡'}</button>
      {!canSave && <p className="danger">以下必选还没填：{missing.join('、')}，填完才能保存。</p>}
      {saveError && <p className="danger">保存失败，请检查网络后重试，刚才的内容还在。</p>}
      {saved && <p className="muted">{synced ? '已保存到你的账号，换设备登录也能看到。' : '仅保存在当前浏览器里（Pages 体验版没有服务器同步），换设备或清缓存会丢失。'}</p>}
    </div>
  )
}
