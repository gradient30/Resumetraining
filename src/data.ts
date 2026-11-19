// Exercise data — practical translation of NICE NG59 / WHO 2023 / Cochrane
// post-discectomy principles. Exact sets/reps are NOT guideline-prescribed;
// they are starting points to confirm with an in-person physiotherapist.
// No sit-ups, crunches, loaded spinal flexion or loaded twisting anywhere.
// Doses follow 每日锻炼方案-修订版v2 (2026-11-19) §5 26-action table and §6
// walking progression. The 24-hour rule is a practical translation,
// not a guideline-prescribed rule.

// Real-person demonstration photos, reused from the stored version
// (same model, white background, yoga mat) plus new photos generated
// in the same style for the exercises that had none.
import chinTuck from './assets/chin-tuck.jpg'
import scapular from './assets/scapular-retraction.jpg'
import chestOpener from './assets/chest-opener.jpg'
import deadBug from './assets/dead-bug-photo.webp'
import gluteBridge from './assets/glute-bridge-photo.jpg'
import birdDogStart from './assets/bird-dog-start.jpg'
import birdDogFinish from './assets/bird-dog-finish.jpg'
import briskWalk from './assets/brisk-walk.jpg'
import hipFlexor from './assets/hip-flexor.jpg'
import wallsit from './assets/wallsit.jpg'
import catcow from './assets/catcow.jpg'
import sideplank from './assets/sideplank.jpg'
import hamstring from './assets/hamstring.jpg'

export type Pose =
  | 'chin'
  | 'shoulder'
  | 'scapular'
  | 'chest'
  | 'deadbug'
  | 'birddog'
  | 'bridge'
  | 'sideplank'
  | 'clamshell'
  | 'wallsit'
  | 'thoracic'
  | 'hinge'
  | 'hipflexor'
  | 'glutestretch'
  | 'hamstring'
  | 'catcow'
  | 'band'
  | 'abduction'
  | 'sittostand'
  | 'bandwalk'
  | 'balance'
  | 'walk'

export interface Exercise {
  id: string
  name: string
  pose: Pose
  group: '颈肩' | '核心腰腹' | '臀腿' | '胸椎' | '活动度' | '拉伸' | '有氧'
  tip: string
  caution?: string
  doses: [string, string, string] // phase 1, 2, 3
}

export const EXERCISES: Exercise[] = [
  { id: 'chin', name: '收下巴', pose: 'chin', group: '颈肩', tip: '缓慢把下巴往后收，感觉后颈轻微拉伸，保持 5–10 秒，不要用力低头。', doses: ['2×10 次', '2×10 次', '2×10 次'] },
  { id: 'shoulder-roll', name: '肩绕环', pose: 'shoulder', group: '颈肩', tip: '双肩向前、向后各绕 10 圈，动作慢而大，坐着站着都能做。', doses: ['前后各 10 次', '前后各 10 次', '前后各 10 次'] },
  { id: 'scapular', name: '肩胛收紧', pose: 'scapular', group: '颈肩', tip: '双肩向后向下收，肩胛骨轻轻夹紧，保持 5 秒，不要耸肩、不要塌腰。', doses: ['2×10 次（保持 5 秒）', '弹力带版 2×10 次，或保持 10 秒', '弹力带版 2×10 次'] },
  { id: 'chest', name: '开胸（门框）', pose: 'chest', group: '颈肩', tip: '手扶门框，身体慢慢前倾，胸口打开，保持 20–30 秒，肋骨不要前顶、腰不要后仰。', doses: ['2×20–30 秒', '2×20–30 秒', '2×20–30 秒'] },
  { id: 'deadbug', name: '死虫式（改良）', pose: 'deadbug', group: '核心腰腹', tip: '仰卧，腰轻轻贴地，对侧手脚慢慢伸出再收回，呼气时用力，腰始终不离地。', caution: '腰拱起或出现腿痛就退回只动手臂。', doses: ['2×6 次/侧', '3×6 次/侧', '3×7 次/侧'] },
  { id: 'birddog', name: '鸟狗式', pose: 'birddog', group: '核心腰腹', tip: '四点跪，对侧手脚慢慢伸直，保持 5–10 秒，身体不晃、腰不塌。先单手或单腿，再做完整版。', doses: ['2×6 次/侧', '3×6 次/侧', '3×7 次/侧 · 10 秒'] },
  { id: 'bridge', name: '臀桥', pose: 'bridge', group: '臀腿', tip: '仰卧屈膝，抬臀到肩髋膝一条线，顶峰收紧臀部，骨盆保持水平，不要塌腰。中间阶：单腿支撑交替抬腿 3×6 次/侧，能无痛、无骨盆晃动完成两周后再进单腿臀桥 3×8 次/侧。', doses: ['2×10 次', '3×10 次', '3×11 次'] },
  { id: 'sideplank', name: '侧平板', pose: 'sideplank', group: '核心腰腹', tip: '侧卧撑起，身体一条线，臀部不掉。先屈膝，再伸直双脚；仅在侧平板 30 秒无痛、无骨盆下掉且经线下康复师确认后方可尝试抬腿。', caution: '髋掉下来或腰痛就停，退回屈膝版。', doses: ['屈膝 2×15 秒/侧', '屈膝 3×15 秒/侧', '伸直 2×20 秒/侧'] },
  { id: 'clamshell', name: '蚌式', pose: 'clamshell', group: '臀腿', tip: '侧卧屈膝，双脚并拢，上面膝盖像贝壳一样打开，骨盆不要跟着翻。', doses: ['2×10 次/侧', '弹力带 2×12 次/侧', '弹力带 2×12 次/侧'] },
  { id: 'abduction', name: '侧卧抬腿', pose: 'abduction', group: '臀腿', tip: '侧卧，上面腿慢慢抬起再放下，身体不动，脚尖朝前。', doses: ['2×10 次/侧', '2×12 次/侧', '2×12 次/侧'] },
  { id: 'wallsit', name: '靠墙静蹲（浅蹲）', pose: 'wallsit', group: '臀腿', tip: '背靠墙，膝盖约 60–70°，不要一上来蹲到 90°；膝盖对准脚尖，不要超过脚尖太多；膝痛就停。照片膝盖约 90°与文字 60–70°矛盾，以文字角度为准。', caution: '这是练腿耐力，不是练腰，别把它当核心动作。', doses: ['2×20 秒', '3×20 秒', '3×22 秒'] },
  { id: 'thoracic', name: '四点跪胸椎旋转', pose: 'thoracic', group: '胸椎', tip: '四点跪，一手扶头，肘部向天花板打开再收回，动作来自胸椎，腰不要跟着转。', doses: ['2×6 次/侧', '3×8 次/侧', '3×8 次/侧'] },
  { id: 'chair-thoracic', name: '椅背胸椎伸展', pose: 'thoracic', group: '胸椎', tip: '双手抱头、胸椎贴椅背缓慢后伸，腰不参与、腿痛即停。', doses: ['2×8 次', '2×8 次', '2×8 次'] },
  { id: 'prone-extension', name: '俯卧背伸', pose: 'birddog', group: '核心腰腹', tip: '双手放体侧、小幅度抬胸，腰痛即停。', doses: ['—（本阶段不做）', '2×8 次，保持 5 秒', '2×8 次，保持 5 秒'] },
  { id: 'hinge', name: '髋铰链（无负重）', pose: 'hinge', group: '臀腿', tip: '双手扶杆贴住头、上背和臀三点，臀部向后推、膝盖微弯，杆始终贴身；练的是弯腰不弯腰椎。', caution: '任何负重铰链、深蹲、提重物都要先经康复师点头。', doses: ['2×8 次', '2×8 次 + 坐站 2×8 次', '2×10 次 + 坐站 2×10 次（无负重）；任何负重须线下康复师同意后另行规定'] },
  { id: 'sittostand', name: '坐站', pose: 'sittostand', group: '臀腿', tip: '坐椅子前沿，身体前倾、脚踩实，慢慢站起再 3 秒坐下，膝盖不要内扣。', doses: ['—（本阶段不做）', '2×8 次', '2×10 次'] },
  { id: 'band', name: '弹力带拉开', pose: 'band', group: '颈肩', tip: '双手握弹力带向前伸直，慢慢向两侧拉开，肩胛收紧，肘微弯。', doses: ['—（本阶段不做）', '2×10 次（轻阻力，拉至肩胛收紧但不耸肩）', '2×10–12 次'] },
  { id: 'band-row', name: '弹力带划船', pose: 'band', group: '颈肩', tip: '坐姿/站姿，肩胛收紧后拉。', doses: ['—（本阶段不做）', '2×10 次', '2×10–12 次'] },
  { id: 'bandwalk', name: '侧向弹力带行走', pose: 'bandwalk', group: '臀腿', tip: '弹力带套在膝盖上方，半蹲姿势小步横向走，膝盖对准脚尖。', doses: ['—（本阶段不做）', '能无痛完成侧卧抬腿 2×12 次后，2×10 步/方向', '2×10 步/方向'] },
  { id: 'balance', name: '单腿站', pose: 'balance', group: '臀腿', tip: '扶墙单腿站 30 秒/侧，眼睛睁开，骨盆保持水平；稳了再放手。进阶阶梯：扶墙 30 秒 → 不扶 30 秒 → 不扶 + 缓慢转头 30 秒，每阶需连续 3 次训练达标才进阶；晃动/扶墙超过 2 次即回上一阶。', doses: ['扶墙 30 秒/侧', '不扶 30 秒/侧', '不扶 + 缓慢转头 30 秒/侧'] },
  { id: 'calf-raise', name: '提踵', pose: 'balance', group: '臀腿', tip: '扶墙站立，脚跟慢慢抬起再放下，动作慢而稳。', doses: ['2×10 次', '2×10 次', '2×12 次'] },
  { id: 'catcow', name: '猫牛式（小幅度）', pose: 'catcow', group: '活动度', tip: '胸椎主导的小幅度活动，腰椎伸展与屈曲均不超过无痛范围，出现腿痛立即停；腰部活动约一半幅度、胸椎为主，作为热身动作。', doses: ['2×8 次', '2×8 次', '2×8 次'] },
  { id: 'hipflexor', name: '髋屈肌拉伸', pose: 'hipflexor', group: '拉伸', tip: '弓步跪姿，骨盆微微后倾，身体直立，不要塌腰去找拉伸感，膝下垫软垫。', doses: ['2×20–30 秒/侧', '2×20–30 秒/侧', '2×20–30 秒/侧'] },
  { id: 'glutestretch', name: '臀部拉伸（仰卧 4 字）', pose: 'glutestretch', group: '拉伸', tip: '仰卧，一腿盘到另一腿膝盖上，轻拉向胸口，不要用力压膝盖。', doses: ['2×20–30 秒/侧', '2×20–30 秒/侧', '2×20–30 秒/侧'] },
  { id: 'hamstring', name: '腘绳肌拉伸（仰卧带子）', pose: 'hamstring', group: '拉伸', tip: '仰卧用带子拉腿，膝盖微弯，只拉到轻微紧张感，绝不站着够脚尖、不弹震。', caution: '拉到膝盖以下腿痛就停，去找康复师。', doses: ['2×20–30 秒/侧', '2×20–30 秒/侧', '2×20–30 秒/侧'] },
  { id: 'walk', name: '快走', pose: 'walk', group: '有氧', tip: '谈话测试：能说短句、不能唱歌；主观用力约 5–6/10。', doses: ['每天 22 分钟', '每天 26–28 分钟', '每天 31–40 分钟'] },
]

// Real-person demonstration photos by exercise id. Exercises without an
// entry here fall back to the hand-drawn SVG figure until a photo is added.
export const EXERCISE_PHOTOS: Record<string, string[]> = {
  chin: [chinTuck],
  scapular: [scapular],
  chest: [chestOpener],
  deadbug: [deadBug],
  birddog: [birdDogStart, birdDogFinish],
  bridge: [gluteBridge],
  hipflexor: [hipFlexor],
  walk: [briskWalk],
  wallsit: [wallsit],
  catcow: [catcow],
  sideplank: [sideplank],
  hamstring: [hamstring],
}

export const PHASES = [
  {
    n: 1, weeks: '第 1–2 周', title: '适应期', desc: '适应期：所有人从这里开始。核心每周 5 次，力量每周 2 次独立力量日（周二、周六，不连续两天），步行每天 22 分钟，每周 ≥150 分钟。',
  },
  {
    n: 2, weeks: '第 3–4 周', title: '建立期', desc: '建立期：加侧向臀肌、胸椎伸展、力量日。核心每周 5 次，力量每周 2 次独立日，步行每天 26–28 分钟。',
  },
  {
    n: 3, weeks: '第 5–8 周', title: '进阶期', desc: '进阶期：力量与有氧量都上去。核心每周 4–5 次，力量每周 2 次（不连续两天），步行每天 31–40 分钟，每周总量 150–300 分钟。',
  },
]

// v2 §2.1 unified red-flag list, five levels. Shared by Onboarding and the
// plan page — both must use this single source, never a local copy.
export const RED_FLAGS = [
  { level: '立即急诊（马尾综合征）', items: ['大小便变化：尿不出来、尿失禁、尿意感觉消失、排尿启动困难/尿不尽、大便失禁或排便感觉消失', '会阴/大腿内侧/生殖器麻木，肛门张力感觉丧失', '双腿疼痛/无力，或单腿无力快速加重', '性功能突然变化', '以上伴随剧烈放射性腰痛'] },
  { level: '当天急诊（感染/脊髓压迫）', items: ['腰痛伴发热、全身不适', '近期尿路感染/结核、糖尿病、静脉吸毒、免疫抑制、长期用激素'] },
  { level: '当天至数日内看医生（肿瘤/骨折）', items: ['有癌症史、不明原因体重下降', '年龄 >50 岁首发腰痛、胸椎痛、平躺加重/持续不缓解、咳嗽/打喷嚏/排便用力时加重', '明显外伤后腰痛，或 >70 岁轻微外伤后疼痛、骨质疏松'] },
  { level: '数周内专科评估（炎症性腰痛）', items: ['<40 岁隐匿起病、>3 个月、晨僵 >30 分钟、运动改善休息不改善、夜间痛起床后缓解'] },
  { level: '尽快临床复评（再突出/新发神经根症状）', items: ['新出现的膝盖以下腿痛、腿麻、无力', '疼痛持续、反复发作、保守治疗不见好（本身不是红旗，需结合其他特征判断）'] },
]

export const DAILY_SKELETON = [
  { time: '早上 5–7 分钟', title: '颈肩 + 胸椎', text: '收下巴、肩绕环、肩胛收紧、椅背胸椎伸展、门框开胸。' },
  { time: '白天 每 30 分钟', title: '打断久坐', text: '起来走 2–5 分钟：肩绕环、收下巴、胸椎旋转、提踵 10 次；每小时争取 5–10 分钟。30 分钟是目前研究中最一致的目标，不是 WHO 规定的医学阈值。' },
  { time: '晚上 3 分钟', title: '热身', text: '慢走 + 猫牛式 2×8 次 + 肩绕环 10 次。' },
  { time: '晚上 15–20 分钟', title: '核心 + 力量', text: '按当前阶段做核心循环；每周 2 次力量日。' },
  { time: '晚上 20–40 分钟', title: '快走', text: '从每天 22 分钟逐步加到 40 分钟，每周 + 约 10%。' },
  { time: '快走后 3 分钟', title: '整理', text: '慢走 + 髋屈肌拉伸 1×30 秒/侧。' },
  { time: '睡前 3–5 分钟', title: '拉伸 + 呼吸', text: '猫牛式、髋屈肌、臀部、腘绳肌拉伸，加 5 次缓慢腹式呼吸。' },
]

// v2 §2.5: everyone starts at phase 1. Baseline self-tests only record a
// starting point and never decide the phase. Only a documented in-person
// physiotherapist assessment may place someone directly in phase 2.
// Parameters are kept so existing callers do not need to change.
export function recommendPhase(_p: {
  singleLeg: number | null
  wallSit: number | null
  pain: number
  legSymptoms: boolean
}): { phase: 1; reasons: string[] } {
  return {
    phase: 1,
    reasons: ['v2规定：所有人从第1阶段开始，至少完成2周无痛打卡且满足24小时规则后方可升入第2阶段；基线自测只记录起点，不用于定阶段。仅有线下康复师评估记录时才可直接进第2阶段。'],
  }
}

export interface PainFeedbackInput {
  pain: number | null
  legPain?: number | null
  peakPain?: number | null
  relieved30?: boolean | null
  newLeg?: boolean
  morningDelta?: number | null
  location?: string | null
}

// v2 §2.3 24-hour rule. The 24-hour rule is a practical translation of
// guideline principles, not a rule directly prescribed by any guideline.
// NOTE: the old painFeedback(pain: number) signature is removed; callers
// (CheckIn / App) must pass the object above.
export function painFeedback(p: PainFeedbackInput): { tone: 'ok' | 'warn' | 'stop'; text: string } {
  const missing =
    p.pain == null || p.peakPain == null || p.relieved30 == null || p.morningDelta == null
  if (missing) {
    return { tone: 'warn', text: '数据不足，暂按减量处理：今天减量一半，补齐运动中痛、运动后30分钟是否缓解、次日晨对比后再判断。24小时规则是实用翻译，非指南直接规定。' }
  }
  const pain = p.pain as number
  const legPain = p.legPain ?? null
  const peakPain = p.peakPain as number
  const relieved30 = p.relieved30 as boolean
  const morningDelta = p.morningDelta as number
  const newLeg = p.newLeg ?? false
  const belowKnee = p.location === '膝以下'
  // Any meaningful leg pain (>= 4) counts as a stop signal alongside
  // >5 waist pain, below-knee radiation and new leg symptoms.
  if (pain > 5 || (legPain != null && legPain >= 4) || newLeg || belowKnee) {
    return { tone: 'stop', text: '停练：疼痛>5分，或放射到膝盖以下，或新出现麻木无力，立即停止当天训练；>5分伴腿痛/麻/无力或疼痛逐次加重当天看医生；单纯腰痛加重无腿症状：停训、相对休息+轻走，48–72小时后以50%量恢复，连续2–3次满足24小时规则再进阶；超过1周不缓解或腿症状持续，必须看理疗师/全科医生。' }
  }
  if (pain >= 4 && pain <= 5) {
    return { tone: 'warn', text: '减量：疼痛4–5分，今天减量一半（组数与保持时间各减半，或退回上一阶段剂量）；连续两天这样再退一步。' }
  }
  if (pain <= 3 && peakPain <= 3 && relieved30 && morningDelta <= 2 && !newLeg && !belowKnee && (legPain == null || legPain <= 3)) {
    return { tone: 'ok', text: '继续：运动中≤3分、30分钟内缓解、次日晨比基线高不超过1–2分且24小时内回到基线、无新发腿症状，可以按计划继续。24小时规则是实用翻译，非指南直接规定。' }
  }
  return { tone: 'warn', text: '减量：疼痛4–5分，今天减量一半（组数与保持时间各减半，或退回上一阶段剂量）；连续两天这样再退一步。' }
}

// v2 §6: daily walking minutes by week (week 1–8), +~10% per week.
export const WALK_WEEKLY = [22, 24, 26, 28, 31, 34, 37, 40]

// Daily walking dose for phase 1 / week 1. The daily dose by week is
// computed by the App from WALK_WEEKLY.
export const WALK_TARGET_MIN = 22

// v2 §3: phase 3 upgrade is manual confirmation, not automatic.
export const PHASE3_RULE_TEXT =
  '第 3 阶段升级为手动确认：连续 14 个自然日内打卡 ≥12 天，且核心完成 ≥10 天、力量完成 ≥4 天，且这 14 天内每次疼痛 ≤3 分且无新发腿症状，同时周数 ≥5；达标时在计划页/首页出现“升级到第 3 阶段”按钮，你点后才升级，升级前显示达标依据，服务端须重新核对打卡记录后才改阶段，不接受客户端直接改阶段。'
