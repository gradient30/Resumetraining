// Exercise data — practical translation of NICE NG59 / WHO 2023 / Cochrane
// post-discectomy principles. Exact sets/reps are NOT guideline-prescribed;
// they are starting points to confirm with an in-person physiotherapist.
// No sit-ups, crunches, loaded spinal flexion or loaded twisting anywhere.

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
  group: '颈肩' | '核心腰腹' | '臀腿' | '胸椎' | '拉伸' | '有氧'
  tip: string
  caution?: string
  doses: [string, string, string] // phase 1, 2, 3
}

export const EXERCISES: Exercise[] = [
  { id: 'chin', name: '收下巴', pose: 'chin', group: '颈肩', tip: '缓慢把下巴往后收，感觉后颈轻微拉伸，保持 5–10 秒，不要用力低头。', doses: ['2×10 次', '2×10 次', '2×10 次'] },
  { id: 'shoulder-roll', name: '肩绕环', pose: 'shoulder', group: '颈肩', tip: '双肩向前、向后各绕 10 圈，动作慢而大，坐着站着都能做。', doses: ['前后各 10 次', '前后各 10 次', '前后各 10 次'] },
  { id: 'scapular', name: '肩胛收紧', pose: 'scapular', group: '颈肩', tip: '双肩向后向下收，肩胛骨轻轻夹紧，保持 5 秒，不要耸肩、不要塌腰。', doses: ['2×10 次', '2×10 次', '2×10 次'] },
  { id: 'chest', name: '开胸（门框）', pose: 'chest', group: '颈肩', tip: '手扶门框，身体慢慢前倾，胸口打开，保持 20–30 秒，肋骨不要前顶、腰不要后仰。', doses: ['2×20–30 秒', '2×20–30 秒', '2×20–30 秒'] },
  { id: 'deadbug', name: '死虫式（改良）', pose: 'deadbug', group: '核心腰腹', tip: '仰卧，腰轻轻贴地，对侧手脚慢慢伸出再收回，呼气时用力，腰始终不离地。', caution: '腰拱起或出现腿痛就退回只动手臂。', doses: ['2×6 次/侧', '3×6–8 次/侧', '3×8 次/侧'] },
  { id: 'birddog', name: '鸟狗式', pose: 'birddog', group: '核心腰腹', tip: '四点跪，对侧手脚慢慢伸直，保持 5–10 秒，身体不晃、腰不塌。先单手或单腿，再做完整版。', doses: ['2×6 次/侧', '3×6–8 次/侧', '3×8 次/侧 · 10 秒'] },
  { id: 'bridge', name: '臀桥', pose: 'bridge', group: '臀腿', tip: '仰卧屈膝，抬臀到肩髋膝一条线，顶峰收紧臀部，骨盆保持水平，不要塌腰。', doses: ['2×10 次', '3×10–12 次', '单腿 3×8–10 次/侧'] },
  { id: 'sideplank', name: '侧平板', pose: 'sideplank', group: '核心腰腹', tip: '侧卧撑起，身体一条线，臀部不掉。先屈膝，再伸直双脚；进阶可加抬腿。', caution: '髋掉下来或腰痛就停，退回屈膝版。', doses: ['屈膝 2×10–15 秒/侧', '3×15–20 秒/侧', '3×20–30 秒/侧'] },
  { id: 'clamshell', name: '蚌式', pose: 'clamshell', group: '臀腿', tip: '侧卧屈膝，双脚并拢，上面膝盖像贝壳一样打开，骨盆不要跟着翻。', doses: ['2×10 次/侧', '弹力带 2×12 次/侧', '弹力带 2×12 次/侧'] },
  { id: 'abduction', name: '侧卧抬腿', pose: 'abduction', group: '臀腿', tip: '侧卧，上面腿慢慢抬起再放下，身体不动，脚尖朝前。', doses: ['第 2 阶段起 · 2×12 次/侧', '2×12 次/侧', '2×12 次/侧'] },
  { id: 'wallsit', name: '靠墙静蹲（浅蹲）', pose: 'wallsit', group: '臀腿', tip: '背靠墙，膝盖约 60–70°，不要一上来蹲到 90°；膝盖对准脚尖，不要超过脚尖太多；膝痛就停。', caution: '这是练腿耐力，不是练腰，别把它当核心动作。', doses: ['2×15–20 秒', '3×20–30 秒', '3×30–45 秒'] },
  { id: 'thoracic', name: '四点跪胸椎旋转', pose: 'thoracic', group: '胸椎', tip: '四点跪，一手扶头，肘部向天花板打开再收回，动作来自胸椎，腰不要跟着转。', doses: ['2×6 次/侧', '3×8 次/侧', '3×8 次/侧'] },
  { id: 'hinge', name: '髋铰链（无负重）', pose: 'hinge', group: '臀腿', tip: '双手扶杆贴住头、上背和臀三点，臀部向后推、膝盖微弯，杆始终贴身；练的是弯腰不弯腰椎。', caution: '任何负重铰链、深蹲、提重物都要先经康复师点头。', doses: ['2×8 次', '2×8 次 + 坐站 2×8 次', '坐站进阶 · 轻负重须康复师同意'] },
  { id: 'sittostand', name: '坐站', pose: 'sittostand', group: '臀腿', tip: '坐椅子前沿，身体前倾、脚踩实，慢慢站起再 3 秒坐下，膝盖不要内扣。', doses: ['第 2 阶段起', '2×8 次', '2×8 次'] },
  { id: 'band', name: '弹力带拉开', pose: 'band', group: '颈肩', tip: '双手握弹力带向前伸直，慢慢向两侧拉开，肩胛收紧，肘微弯。', doses: ['第 2 阶段起 · 2×10 次', '2×10 次', '2–3×10–12 次'] },
  { id: 'bandwalk', name: '侧向弹力带行走', pose: 'bandwalk', group: '臀腿', tip: '弹力带套在膝盖上方，半蹲姿势小步横向走，膝盖对准脚尖。', doses: ['第 3 阶段起', '第 3 阶段起', '2×10 步/方向'] },
  { id: 'balance', name: '单腿站', pose: 'balance', group: '臀腿', tip: '扶墙单腿站 30 秒/侧，眼睛睁开，骨盆保持水平；稳了再放手。', doses: ['30 秒/侧', '30 秒/侧', '30 秒/侧'] },
  { id: 'catcow', name: '猫牛式（小幅度）', pose: 'catcow', group: '拉伸', tip: '四点跪，吸气塌腰、呼气拱背，腰的幅度要小，重点在胸椎；出现腿痛马上停。', doses: ['2×8 次', '2×8 次', '2×8 次'] },
  { id: 'hipflexor', name: '髋屈肌拉伸', pose: 'hipflexor', group: '拉伸', tip: '弓步跪姿，骨盆微微后倾，身体直立，不要塌腰去找拉伸感，膝下垫软垫。', doses: ['2×20–30 秒/侧', '2×20–30 秒/侧', '2×20–30 秒/侧'] },
  { id: 'glutestretch', name: '臀部拉伸（仰卧 4 字）', pose: 'glutestretch', group: '拉伸', tip: '仰卧，一腿盘到另一腿膝盖上，轻拉向胸口，不要用力压膝盖。', doses: ['2×20–30 秒/侧', '2×20–30 秒/侧', '2×20–30 秒/侧'] },
  { id: 'hamstring', name: '腘绳肌拉伸（仰卧带子）', pose: 'hamstring', group: '拉伸', tip: '仰卧用带子拉腿，膝盖微弯，只拉到轻微紧张感，绝不站着够脚尖、不弹震。', caution: '拉到膝盖以下腿痛就停，去找康复师。', doses: ['2×20–30 秒/侧', '2×20–30 秒/侧', '2×20–30 秒/侧'] },
  { id: 'walk', name: '快走', pose: 'walk', group: '有氧', tip: '中速到快走，能说话但呼吸明显加快；每周总量目标 150 分钟以上，逐步加到 150–300 分钟。', doses: ['每天 20 分钟', '每天 25–30 分钟', '每天 30–45 分钟'] },
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
    n: 1, weeks: '第 1–2 周', title: '适应期', desc: '重新学会动作，全部无痛完成。核心每周 5 次，力量每周 2 次（同一次训练、轻量），步行每天 20 分钟。',
  },
  {
    n: 2, weeks: '第 3–4 周', title: '建立期', desc: '加上侧向臀肌、胸椎和力量量。核心每周 5 次，力量每周 2 次，步行每天 25–30 分钟。',
  },
  {
    n: 3, weeks: '第 5–8 周', title: '进阶期', desc: '力量与有氧量都上去。核心每周 4–5 次，力量每周 2 次（不连续两天），步行每天 30–45 分钟，每周总量 ≥150 分钟。',
  },
]

export const RED_FLAGS = [
  { level: '紧急 · 立即就医', items: ['大小便失禁、尿不出来、肛门周围麻木', '会阴/大腿内侧麻木（马鞍区麻木）', '双腿疼痛无力，或单腿无力快速加重', '以上伴随剧烈放射性腰痛'] },
  { level: '紧急 · 当天/几天内看医生', items: ['腰痛伴发热、全身不适', '有癌症史、不明原因体重下降', '明显外伤后腰痛，或轻微跌倒后疼痛', '夜间持续剧痛、任何姿势都不缓解', '长期用激素、免疫抑制、静脉吸毒史', '新出现的腿麻、无力'] },
  { level: '尽快复查', items: ['疼痛持续、反复发作、保守治疗不见好', '新出现的膝盖以下腿痛', '晨僵超过 30 分钟、活动后好转'] },
]

export const DAILY_SKELETON = [
  { time: '早上 5–7 分钟', title: '颈肩 + 胸椎', text: '收下巴、肩绕环、肩胛收紧、站姿胸椎旋转、门框开胸。' },
  { time: '白天 每 30 分钟', title: '打断久坐', text: '起来走 2–3 分钟：肩绕环、收下巴、胸椎旋转、提踵 10 次；每小时争取 5–10 分钟。' },
  { time: '晚上 15–20 分钟', title: '核心 + 力量', text: '按当前阶段做核心循环；每周 2 次力量日。' },
  { time: '晚上 20–45 分钟', title: '快走', text: '从每天 20 分钟逐步加到 30–45 分钟。' },
  { time: '睡前 3–5 分钟', title: '拉伸 + 呼吸', text: '猫牛式、髋屈肌、臀部、腘绳肌拉伸，加 5 次缓慢腹式呼吸。' },
]

export function recommendPhase(p: {
  singleLeg: number | null
  wallSit: number | null
  pain: number
  legSymptoms: boolean
}): { phase: 1 | 2; reasons: string[] } {
  const reasons: string[] = []
  const strong =
    (p.singleLeg ?? 0) >= 30 && (p.wallSit ?? 0) >= 60 && p.pain <= 3 && !p.legSymptoms
  if (strong) {
    reasons.push('单腿站 ≥30 秒、靠墙静蹲 ≥60 秒、腰痛 ≤3 分、无腿部症状')
    return { phase: 2, reasons }
  }
  if ((p.singleLeg ?? 0) < 30) reasons.push('单腿站不足 30 秒，先从适应期打基础')
  if ((p.wallSit ?? 0) < 60) reasons.push('靠墙静蹲不足 60 秒，先从适应期打基础')
  if (p.pain > 3) reasons.push('当前腰痛超过 3 分，先从适应期开始')
  if (p.legSymptoms) reasons.push('有腿部症状，先从适应期开始，出现加重及时就医')
  if (reasons.length === 0) reasons.push('按基线评估，从适应期开始最稳妥')
  return { phase: 1, reasons }
}

export function painFeedback(pain: number): { tone: 'ok' | 'warn' | 'stop'; text: string } {
  if (pain <= 3) return { tone: 'ok', text: '继续：疼痛 ≤3 分，且 30 分钟内缓解、第二天早上不比平时高 1–2 分以上，就可以按计划继续。' }
  if (pain <= 5) return { tone: 'warn', text: '减量：疼痛 4–5 分，今天减量一半，退回上一步的量；连续两天这样就再退一步，出现腿痛、麻木、无力马上停。' }
  return { tone: 'stop', text: '停练并观察：疼痛超过 5 分，或放射到膝盖以下，或新出现麻木无力，立即停止当天训练；持续不缓解去看医生。' }
}
