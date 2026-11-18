import { useState } from 'react'
import { recommendPhase } from '../data'
import type { Profile } from '../api'

const RED_FLAG_ITEMS = [
  '大小便失禁、尿不出来、肛门周围麻木',
  '会阴 / 大腿内侧麻木',
  '双腿疼痛无力，或单腿无力快速加重',
  '腰痛伴发热、全身不适',
  '有癌症史、不明原因体重下降',
  '明显外伤后腰痛',
  '夜间持续剧痛、任何姿势都不缓解',
]

export default function Onboarding({ onDone, onSkip }: { onDone: (p: Profile) => void; onSkip: () => void }) {
  const [step, setStep] = useState(1)
  const [f, setF] = useState<Profile>({
    height_cm: 180, weight_kg: 76, pain_now: 0,
    leg_pain: false, leg_numbness: false, leg_weakness: false,
    single_leg_seconds: null, wall_sit_seconds: null,
  })
  const [flags, setFlags] = useState<string[]>([])
  const set = (k: keyof Profile, v: unknown) => setF((prev) => ({ ...prev, [k]: v }))
  const num = (v: string) => (v === '' ? null : Number(v))

  if (step === 4) {
    const rec = recommendPhase({
      singleLeg: f.single_leg_seconds ?? null,
      wallSit: f.wall_sit_seconds ?? null,
      pain: f.pain_now ?? 0,
      legSymptoms: !!(f.leg_pain || f.leg_numbness || f.leg_weakness),
    })
    return (
      <div className="card">
        <h2>推荐起始阶段：第 {rec.phase} 阶段</h2>
        <ul>{rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        <p className="muted">第 3 阶段不靠问卷进入，要靠两周打卡的疼痛记录来升级。计划开始日记为今天。</p>
        <button className="primary" onClick={() => onDone({ ...f, recommended_phase: rec.phase, current_phase: rec.phase, start_date: new Date().toISOString().slice(0, 10) })}>开始第 {rec.phase} 阶段训练</button>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>第一次使用 · 个人档案（第 {step} / 3 步）</h2>
      <p className="muted">只问训练必需的信息，5 分钟填完。数据存在你的 Cloudflare D1 数据库里，不公开。</p>
      {step === 1 && (
        <div>
          <label>年龄（岁）</label>
          <input type="number" inputMode="numeric" value={f.age ?? ''} onChange={(e) => set('age', num(e.target.value))} placeholder="例如 35" />
          <label>身高（cm）</label>
          <input type="number" value={f.height_cm ?? ''} onChange={(e) => set('height_cm', num(e.target.value) ?? 180)} />
          <label>体重（kg）</label>
          <input type="number" value={f.weight_kg ?? ''} onChange={(e) => set('weight_kg', num(e.target.value) ?? 76)} />
          <label>腰围（cm，如已量过）</label>
          <input type="number" value={f.waist_cm ?? ''} onChange={(e) => set('waist_cm', num(e.target.value))} placeholder="今晚第一次量也可以先空着" />
          <label>每天睡眠（小时）</label>
          <input type="number" value={f.sleep_hours ?? ''} onChange={(e) => set('sleep_hours', num(e.target.value))} />
          <label>每天久坐（小时）</label>
          <input type="number" value={f.sitting_hours ?? ''} onChange={(e) => set('sitting_hours', num(e.target.value))} />
          <label>日均步数</label>
          <input type="number" value={f.daily_steps ?? ''} onChange={(e) => set('daily_steps', num(e.target.value))} />
          <button className="primary" onClick={() => setStep(2)}>下一步：症状筛查</button>
        </div>
      )}
      {step === 2 && (
        <div>
          <label>现在腰痛几分（0–10 分，0 = 不痛）</label>
          <div className="painrow">
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} type="button" className={f.pain_now === i ? 'sel' : ''} onClick={() => set('pain_now', i)}>{i}</button>
            ))}
          </div>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.leg_pain} onChange={(e) => set('leg_pain', e.target.checked)} /> 腿痛（放射到腿上）</label>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.leg_numbness} onChange={(e) => set('leg_numbness', e.target.checked)} /> 腿麻</label>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.leg_weakness} onChange={(e) => set('leg_weakness', e.target.checked)} /> 腿无力</label>
          <h3>红旗筛查（勾中任何一项，先不要训练，先去看医生）</h3>
          {RED_FLAG_ITEMS.map((item) => (
            <label key={item}><input type="checkbox" style={{ width: 'auto' }} checked={flags.includes(item)} onChange={(e) => setFlags(e.target.checked ? [...flags, item] : flags.filter((x) => x !== item))} /> {item}</label>
          ))}
          {flags.length > 0 && (
            <div className="danger"><strong>先不要训练。</strong>你勾了红旗项目，请先去急诊或尽快看医生，确认后再回来建档。出现大小便、会阴麻木、双腿无力属于急诊情况。</div>
          )}
          <button className="primary" disabled={flags.length > 0} onClick={() => setStep(3)}>下一步：基线与偏好</button>
          <p><button type="button" onClick={() => setStep(1)}>上一步</button></p>
        </div>
      )}
      {step === 3 && (
        <div>
          <p className="muted">两个低风险自测，撑不住就停，不要硬撑。扶墙做更安全。</p>
          <label>单腿站能撑多少秒（扶墙，眼睛睁开）</label>
          <input type="number" value={f.single_leg_seconds ?? ''} onChange={(e) => set('single_leg_seconds', num(e.target.value))} placeholder="例如 20" />
          <label>靠墙静蹲能撑多少秒（膝盖约 60–70°，不要蹲到 90°）</label>
          <input type="number" value={f.wall_sit_seconds ?? ''} onChange={(e) => set('wall_sit_seconds', num(e.target.value))} placeholder="例如 30" />
          <label>每天能练多长时间（分钟）</label>
          <input type="number" value={f.daily_minutes ?? ''} onChange={(e) => set('daily_minutes', num(e.target.value))} placeholder="例如 30" />
          <label>器械</label>
          <select value={f.equipment ?? ''} onChange={(e) => set('equipment', e.target.value)}>
            <option value="">无器械</option>
            <option value="弹力带">有弹力带</option>
            <option value="弹力带+哑铃">弹力带 + 哑铃</option>
          </select>
          <label>优先改善部位</label>
          <select value={f.focus ?? ''} onChange={(e) => set('focus', e.target.value)}>
            <option value="">腰腹为主</option>
            <option value="颈肩">颈肩为主</option>
            <option value="腰腹">腰腹为主</option>
            <option value="全身均衡">全身均衡</option>
          </select>
          <button className="primary" onClick={() => setStep(4)}>查看推荐阶段</button>
          <p><button type="button" onClick={() => setStep(2)}>上一步</button> <button type="button" onClick={onSkip}>稍后再填</button></p>
        </div>
      )}
    </div>
  )
}
