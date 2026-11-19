import { useState } from 'react'
import { RED_FLAGS, recommendPhase } from '../data'
import type { Profile } from '../api'

// 本地扩展档案类型：C 组正在给 api.ts 的 Profile 加这些可选字段，
// 在此之前用本地类型兜底，提交时再转回 Profile。
type OnbProfile = Omit<Profile, 'pain_now'> & {
  pain_now?: number | null
  red_flag_items?: string[]
  single_leg_left?: number | null
  single_leg_right?: number | null
  side_plank_seconds?: number | null
  smoking?: boolean
  diabetes?: boolean
  annular_defect?: boolean
  recurrence?: boolean
  heart_disease?: boolean
  hypertension?: boolean
  medication?: boolean
  exercise_chest_pain?: boolean
  doctor_assessed_leg?: boolean
  sleep_quality?: '好' | '一般' | '差'
  yellow_flags?: string[]
  waist_target_cm?: number | null
  waist_target_mode?: 'below94' | 'minus3' | null
}

const YELLOW_FLAG_ITEMS = [
  '害怕活动会加重腰痛',
  '总担心腰坏了',
  '情绪低落/焦虑',
  '睡眠差影响恢复',
  '担心工作/病假',
]

// 红旗分级就医指引：按 RED_FLAGS 的 level 文案关键字分级；
// A 组把 RED_FLAGS 改为五级后，同一套关键字仍能对应上。
function levelAdvice(level: string): string {
  if (/马尾|立即急诊/.test(level)) return '立即急诊：怀疑马尾综合征，不要等，立即去急诊或打 120。'
  if (/当天急诊/.test(level)) return '当天急诊：当天去看医生。'
  if (/数日内/.test(level)) return '当天至数日内看医生。'
  if (/数周内|专科/.test(level)) return '数周内到专科评估。'
  if (/复评|尽快/.test(level)) return '尽快到门诊临床复评。'
  return level
}

function localDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Onboarding({ onDone, synced }: { onDone: (p: Profile) => Promise<void>; onSkip: () => void; synced?: boolean }) {
  const [step, setStep] = useState(1)
  // Height and weight start blank: pre-filling one user's numbers would
  // make every new account inherit them (and the wrong BMI with them).
  const [f, setF] = useState<OnbProfile>({
    pain_now: null,
    leg_pain: false, leg_numbness: false, leg_weakness: false,
    single_leg_seconds: null, wall_sit_seconds: null,
    yellow_flags: [],
  })
  const [flags, setFlags] = useState<string[]>([])
  const [step1Error, setStep1Error] = useState('')
  const [saveError, setSaveError] = useState(false)
  // 屈膝侧平板左右各测 1 次（本地状态），提交时取较差侧写入 side_plank_seconds。
  const [sidePlankLeft, setSidePlankLeft] = useState<number | null>(null)
  const [sidePlankRight, setSidePlankRight] = useState<number | null>(null)
  const [supportLeft, setSupportLeft] = useState(false)
  const [supportRight, setSupportRight] = useState(false)
  const set = (k: keyof OnbProfile, v: unknown) => setF((prev) => ({ ...prev, [k]: v }))
  const num = (v: string) => (v === '' ? null : Number(v))

  const toggleYellow = (item: string) =>
    set('yellow_flags', (f.yellow_flags ?? []).includes(item)
      ? (f.yellow_flags ?? []).filter((x) => x !== item)
      : [...(f.yellow_flags ?? []), item])

  // 第 1 步：吸烟 / 糖尿病 / 环形缺损 / 复发 / 心血管筛查，任一项阳性只提示线下复评，不拦截、不用于分层。
  const reviewHint = !!(
    f.smoking || f.diabetes || f.annular_defect || f.recurrence ||
    f.heart_disease || f.hypertension || f.medication || f.exercise_chest_pain
  )
  const yellowCount = (f.yellow_flags ?? []).length

  const validateStep1 = (): string => {
    if (!f.height_cm || !f.weight_kg) return '身高和体重都要填，才能算 BMI 和定阶段'
    if (f.age != null && (f.age < 18 || f.age > 100)) return '年龄应在 18–100 岁之间，请检查一下'
    if (f.height_cm < 100 || f.height_cm > 250) return '身高应在 100–250 cm 之间，请检查一下'
    if (f.weight_kg < 20 || f.weight_kg > 300) return '体重应在 20–300 kg 之间，请检查一下'
    if (f.waist_cm != null && (f.waist_cm < 50 || f.waist_cm > 150)) return '腰围应在 50–150 cm 之间，请检查一下'
    return ''
  }

  // 第 2 步硬拦截：任一腿症状勾选且未勾“已由医生评估”，或腰痛 ≥7 分。
  // 红旗阳性不是硬拦截：允许完成建档并把 red_flag/red_flag_items 写入档案，
  // 训练入口由 App 锁定（未就医排除前不能训练）。以前把红旗也算进 blocked，
  // 导致勾中红旗永远到不了提交页、red_flag 恒为 0，这是 P0-1 的原 bug。
  const anyLeg = !!(f.leg_pain || f.leg_numbness || f.leg_weakness)
  const unassessedLeg = anyLeg && !f.doctor_assessed_leg
  const painHigh = (f.pain_now ?? 0) >= 7
  const blocked = unassessedLeg || painHigh
  const flaggedGroups = RED_FLAGS
    .map((g) => ({ level: g.level, items: g.items.filter((i) => flags.includes(i)) }))
    .filter((g) => g.items.length > 0)

  // 第 3 步基线：单腿站取较差侧；左右差 >5 秒提示线下评估。
  const worseLeg =
    f.single_leg_left != null && f.single_leg_right != null
      ? Math.min(f.single_leg_left, f.single_leg_right)
      : (f.single_leg_left ?? f.single_leg_right ?? null)
  const legDiff =
    f.single_leg_left != null && f.single_leg_right != null
      ? Math.abs(f.single_leg_left - f.single_leg_right)
      : null
  const worsePlank =
    sidePlankLeft != null && sidePlankRight != null
      ? Math.min(sidePlankLeft, sidePlankRight)
      : (sidePlankLeft ?? sidePlankRight ?? null)

  if (step === 4) {
    const rec = recommendPhase({
      singleLeg: worseLeg,
      wallSit: f.wall_sit_seconds ?? null,
      pain: f.pain_now ?? 0,
      legSymptoms: anyLeg,
    })
    return (
      <div className="card">
        <h2>推荐起始阶段：第 {rec.phase} 阶段</h2>
        <ul>{rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        <p className="muted">所有人从第 1 阶段开始，基线自测只用于记录起点，不用于定阶段。至少完成 2 周无痛打卡且满足 24 小时规则后，方可升入第 2 阶段。第 3 阶段不靠问卷进入，要靠打卡记录手动确认升级。计划开始日记为今天。</p>
        <button className="primary" onClick={async () => {
          setSaveError(false)
          try {
            await onDone({
              ...f,
              single_leg_seconds: worseLeg,
              side_plank_seconds: worsePlank,
              red_flag: flags.length > 0,
              red_flag_items: flags,
              recommended_phase: 1,
              current_phase: 1,
              start_date: localDateStr(),
            } as unknown as Profile)
          } catch { setSaveError(true) }
        }}>{flags.length > 0 ? '保存档案（红旗已锁定训练，先就医）' : `开始第 ${rec.phase} 阶段训练`}</button>
        {flags.length > 0 && (
          <div className="danger"><strong>你勾了红旗项目，训练将被锁定。</strong>保存档案后请先就医，就医排除并在档案页点“已就医排除”复核后，才能开始训练。</div>
        )}
        {saveError && <p className="danger">保存失败，请检查网络后重试，刚才填的内容还在。</p>}
      </div>
    )
  }

  return (
    <div className="card">
      <h2>第一次使用 · 个人档案（第 {step} / 3 步）</h2>
      <p className="muted">只问训练必需的信息，5 分钟填完。{synced ? '数据存在你的账号里，不公开，换设备登录也能看到。' : '数据只保存在当前浏览器里，换设备或清缓存会丢失。'}</p>
      {step === 1 && (
        <div>
          <label>年龄（岁）</label>
          <input type="number" inputMode="numeric" value={f.age ?? ''} onChange={(e) => set('age', num(e.target.value))} placeholder="例如 35" />
          <label>身高（cm）</label>
          <input type="number" value={f.height_cm ?? ''} onChange={(e) => set('height_cm', num(e.target.value))} placeholder="例如 180" />
          <label>体重（kg）</label>
          <input type="number" value={f.weight_kg ?? ''} onChange={(e) => set('weight_kg', num(e.target.value))} placeholder="例如 76" />
          <label>腰围（cm，如已量过）</label>
          <input type="number" value={f.waist_cm ?? ''} onChange={(e) => set('waist_cm', num(e.target.value))} placeholder="今晚第一次量也可以先空着" />
          <label>每天睡眠（小时）</label>
          <input type="number" value={f.sleep_hours ?? ''} onChange={(e) => set('sleep_hours', num(e.target.value))} />
          <label>睡眠质量</label>
          <select value={f.sleep_quality ?? ''} onChange={(e) => set('sleep_quality', e.target.value === '' ? undefined : e.target.value)}>
            <option value="">未选</option>
            <option value="好">好</option>
            <option value="一般">一般</option>
            <option value="差">差</option>
          </select>
          <label>每天久坐（小时）</label>
          <input type="number" value={f.sitting_hours ?? ''} onChange={(e) => set('sitting_hours', num(e.target.value))} />
          <label>日均步数</label>
          <input type="number" value={f.daily_steps ?? ''} onChange={(e) => set('daily_steps', num(e.target.value))} />
          <h3>既往情况筛查（只用于提示“建议线下复评”，不拦截、不用于分层）</h3>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.smoking} onChange={(e) => set('smoking', e.target.checked)} /> 吸烟</label>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.diabetes} onChange={(e) => set('diabetes', e.target.checked)} /> 糖尿病</label>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.annular_defect} onChange={(e) => set('annular_defect', e.target.checked)} /> 已知环形缺损 / 手术细节（如缺损大小、手术方式）</label>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.recurrence} onChange={(e) => set('recurrence', e.target.checked)} /> 既往复发（术后同部位再次突出或症状复发）</label>
          <h3>心血管 / 共病筛查（任一项阳性，先提示就医评估）</h3>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.heart_disease} onChange={(e) => set('heart_disease', e.target.checked)} /> 已知心脏病</label>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.hypertension} onChange={(e) => set('hypertension', e.target.checked)} /> 高血压</label>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.medication} onChange={(e) => set('medication', e.target.checked)} /> 正在用药（如降压药、降糖药、抗凝药等）</label>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.exercise_chest_pain} onChange={(e) => set('exercise_chest_pain', e.target.checked)} /> 运动中胸痛 / 呼吸困难史</label>
          {reviewHint && (
            <div className="warn">提示：你勾了上面的一项或多项，建议先找线下医生 / 康复师复评一次，再开始训练。这只是提醒，不会拦住你继续填。</div>
          )}
          <h3>黄旗简筛（害怕、担心、情绪、睡眠、工作，共 5 项）</h3>
          {YELLOW_FLAG_ITEMS.map((item) => (
            <label key={item}><input type="checkbox" style={{ width: 'auto' }} checked={(f.yellow_flags ?? []).includes(item)} onChange={() => toggleYellow(item)} /> {item}</label>
          ))}
          {yellowCount >= 2 && (
            <div className="warn">提示：黄旗勾了 {yellowCount} 项，已在档案中标注，建议线下复评一次。</div>
          )}
          {step1Error && <p className="danger">{step1Error}</p>}
          <button className="primary" onClick={() => { const err = validateStep1(); if (err) { setStep1Error(err); return } setStep1Error(''); setStep(2) }}>下一步：症状筛查</button>
        </div>
      )}
      {step === 2 && (
        <div>
          <label>现在腰痛几分（0–10 分，0 = 不痛）{f.pain_now === null && <span className="danger">必选</span>}</label>
          <div className="painrow">
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} type="button" className={f.pain_now === i ? 'sel' : ''} onClick={() => set('pain_now', i)}>{i}</button>
            ))}
          </div>
          {f.pain_now === null && <p className="danger">腰痛分是必选的，选一个再继续。</p>}
          <p className="muted">锚点：0 不痛、1–3 轻微可忍、4–6 中度影响活动、7–10 剧烈难忍。</p>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.leg_pain} onChange={(e) => set('leg_pain', e.target.checked)} /> 腿痛（放射到腿上）</label>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.leg_numbness} onChange={(e) => set('leg_numbness', e.target.checked)} /> 腿麻</label>
          <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.leg_weakness} onChange={(e) => set('leg_weakness', e.target.checked)} /> 腿无力</label>
          {anyLeg && (
            <div>
              <p className="muted">腿症状请注意“新发 / 加重”：新出现的腿麻、无力，或原有症状突然加重，都属于要先就医的情况，不是“从低阶段开始练”的指征。</p>
              <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.doctor_assessed_leg} onChange={(e) => set('doctor_assessed_leg', e.target.checked)} /> 已由医生评估的稳定残留轻微症状（建档时已知、稳定、医生已评估过）</label>
            </div>
          )}
          <h3>红旗筛查（勾中任何一项，先不要训练，先去看医生）</h3>
          {RED_FLAGS.map((g) => (
            <div key={g.level}>
              <p><strong>{g.level}</strong></p>
              {g.items.map((item) => (
                <label key={item}><input type="checkbox" style={{ width: 'auto' }} checked={flags.includes(item)} onChange={(e) => setFlags(e.target.checked ? [...flags, item] : flags.filter((x) => x !== item))} /> {item}</label>
              ))}
            </div>
          ))}
          {blocked && (
            <div className="danger">
              <strong>先不要训练，先去就医。</strong>
              {flaggedGroups.map((g) => (
                <p key={g.level}><strong>{g.level}：</strong>{levelAdvice(g.level)}你勾了：{g.items.join('；')}</p>
              ))}
              {unassessedLeg && <p>腿症状：你勾了腿部症状，但未勾“已由医生评估的稳定残留轻微症状”——新发腿无力、双腿症状、腿麻新发或加重都属于硬拦截，请先就医评估。</p>}
              {painHigh && <p>腰痛 ≥7 分：请先就医评估，确认后再回来建档。</p>}
            </div>
          )}
          <button className="primary" disabled={f.pain_now === null || blocked} onClick={() => setStep(3)}>下一步：基线与偏好</button>
          {f.pain_now === null && <p className="danger">请先选腰痛分。</p>}
          <p><button type="button" onClick={() => setStep(1)}>上一步</button></p>
        </div>
      )}
      {step === 3 && (
        <div>
          <p className="muted">三个低风险自测，撑不住就停，不要硬撑。只用于记录起点，不用于定阶段——所有人从第 1 阶段开始。</p>
          <label>单腿站左腿能撑多少秒（不扶墙，每腿各测 1 次）</label>
          <input type="number" value={f.single_leg_left ?? ''} onChange={(e) => set('single_leg_left', num(e.target.value))} placeholder="例如 20" />
          <label><input type="checkbox" style={{ width: 'auto' }} checked={supportLeft} onChange={(e) => { setSupportLeft(e.target.checked); if (e.target.checked) set('single_leg_left', 0) }} /> 左腿站不稳，需扶墙（记 0 秒）</label>
          <label>单腿站右腿能撑多少秒（不扶墙，每腿各测 1 次）</label>
          <input type="number" value={f.single_leg_right ?? ''} onChange={(e) => set('single_leg_right', num(e.target.value))} placeholder="例如 20" />
          <label><input type="checkbox" style={{ width: 'auto' }} checked={supportRight} onChange={(e) => { setSupportRight(e.target.checked); if (e.target.checked) set('single_leg_right', 0) }} /> 右腿站不稳，需扶墙（记 0 秒）</label>
          {worseLeg != null && <p className="muted">较差侧：{worseLeg} 秒。</p>}
          {legDiff != null && legDiff > 5 && <p className="warn">左右差 {legDiff} 秒（&gt;5 秒），建议线下评估一次。</p>}
          <label>靠墙静蹲能撑多少秒（膝盖约 60–70°，不要蹲到 90°；上限 60 秒）</label>
          <input type="number" value={f.wall_sit_seconds ?? ''} onChange={(e) => { const v = num(e.target.value); set('wall_sit_seconds', v == null ? null : Math.min(60, v)) }} placeholder="例如 30" />
          <p className="muted">先热身、扶墙再测；出现膝以下腿痛立即停止并就医评估。测到 60 秒就停，不用再撑。</p>
          <label>屈膝侧平板左保持多少秒（左右各一）</label>
          <input type="number" value={sidePlankLeft ?? ''} onChange={(e) => setSidePlankLeft(num(e.target.value))} placeholder="例如 15" />
          <label>屈膝侧平板右保持多少秒（左右各一）</label>
          <input type="number" value={sidePlankRight ?? ''} onChange={(e) => setSidePlankRight(num(e.target.value))} placeholder="例如 15" />
          {worsePlank != null && <p className="muted">较差侧：{worsePlank} 秒。</p>}
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
          <p><button type="button" onClick={() => setStep(2)}>上一步</button></p>
          <p className="muted">筛查是训练前置必做项，不能跳过；如需稍后填，可关闭本页，回来再继续。</p>
        </div>
      )}
    </div>
  )
}
