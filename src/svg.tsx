// Clean, hand-drawn SVG human-like figures. No photos, no external URLs,
// so there is no copyright or hotlink risk. Each pose is a simple
// side/front figure with a floor line and a movement arrow.
import type { Pose } from './data'

function Figure({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 200 130" role="img" aria-label={label} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect x="0" y="0" width="200" height="130" rx="12" fill="#eef4ff" />
      <line x1="12" y1="112" x2="188" y2="112" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      {children}
    </svg>
  )
}

const head = (cx: number, cy: number, r = 11) => (
  <circle cx={cx} cy={cy} r={r} fill="#fcd9b8" stroke="#1e293b" strokeWidth="2" />
)
const limb = (x1: number, y1: number, x2: number, y2: number, w = 5) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1e293b" strokeWidth={w} strokeLinecap="round" />
)
const torso = (x1: number, y1: number, x2: number, y2: number, w = 7) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2563eb" strokeWidth={w} strokeLinecap="round" />
)
const arrow = (x1: number, y1: number, x2: number, y2: number) => (
  <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#dc2626" strokeWidth="2.5" strokeDasharray="5 3" />
    <polygon points={`${x2},${y2} ${x2 - 7},${y2 - 3} ${x2 - 7},${y2 + 3}`} fill="#dc2626" />
  </g>
)

export function ExerciseSvg({ pose, name }: { pose: Pose; name: string }) {
  switch (pose) {
    case 'chin':
      return <Figure label={name}>{head(92, 42)}{torso(92, 54, 92, 92)}{limb(92, 64, 68, 88)}{limb(92, 64, 116, 88)}{limb(92, 92, 82, 112)}{limb(92, 92, 102, 112)}{arrow(108, 42, 92, 42)}</Figure>
    case 'shoulder':
      return <Figure label={name}>{head(100, 38)}{torso(100, 50, 100, 90)}{limb(100, 58, 74, 78)}{limb(100, 58, 126, 78)}{limb(100, 90, 90, 112)}{limb(100, 90, 110, 112)}<circle cx="100" cy="58" r="18" fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="4 3" /></Figure>
    case 'scapular':
      return <Figure label={name}>{head(100, 36)}{torso(100, 48, 100, 88)}{limb(100, 56, 76, 72)}{limb(100, 56, 124, 72)}{limb(100, 88, 90, 112)}{limb(100, 88, 110, 112)}{arrow(76, 72, 88, 64)}{arrow(124, 72, 112, 64)}</Figure>
    case 'chest':
      return <Figure label={name}>{head(96, 40)}{torso(96, 52, 96, 90)}{limb(96, 60, 62, 52)}{limb(96, 60, 130, 52)}{limb(96, 90, 86, 112)}{limb(96, 90, 106, 112)}<line x1="150" y1="20" x2="150" y2="112" stroke="#94a3b8" strokeWidth="4" />{arrow(130, 52, 146, 52)}</Figure>
    case 'deadbug':
      return <Figure label={name}>{head(52, 92)}{torso(64, 98, 108, 98)}{limb(108, 98, 128, 98)}{limb(64, 98, 52, 82)}{limb(108, 98, 128, 74)}{limb(108, 98, 88, 112)}{limb(88, 112, 88, 98)}{arrow(128, 74, 142, 62)}{arrow(128, 98, 146, 98)}</Figure>
    case 'birddog':
      return <Figure label={name}>{head(58, 66)}{torso(70, 72, 118, 72)}{limb(70, 72, 58, 96)}{limb(70, 72, 58, 112)}{limb(118, 72, 136, 96)}{limb(118, 72, 136, 112)}{limb(70, 72, 40, 58)}{limb(118, 72, 152, 52)}{arrow(152, 52, 166, 44)}</Figure>
    case 'bridge':
      return <Figure label={name}>{head(48, 96)}{torso(60, 100, 104, 78)}{limb(104, 78, 126, 100)}{limb(126, 100, 126, 112)}{limb(60, 100, 52, 112)}{arrow(104, 78, 104, 62)}</Figure>
    case 'sideplank':
      return <Figure label={name}>{head(60, 52)}{torso(70, 58, 118, 96)}{limb(70, 58, 66, 84)}{limb(118, 96, 132, 112)}{limb(118, 96, 108, 112)}{arrow(118, 96, 132, 84)}</Figure>
    case 'clamshell':
      return <Figure label={name}>{head(52, 88)}{torso(64, 94, 104, 94)}{limb(104, 94, 132, 76)}{limb(104, 94, 132, 104)}{arrow(132, 76, 140, 62)}</Figure>
    case 'wallsit':
      return <Figure label={name}><line x1="150" y1="16" x2="150" y2="112" stroke="#94a3b8" strokeWidth="5" />{head(118, 42)}{torso(122, 54, 126, 84)}{limb(126, 84, 106, 84)}{limb(106, 84, 106, 112)}{limb(122, 60, 146, 72)}{arrow(106, 84, 106, 70)}</Figure>
    case 'thoracic':
      return <Figure label={name}>{head(58, 66)}{torso(70, 72, 118, 72)}{limb(70, 72, 58, 96)}{limb(70, 72, 58, 112)}{limb(118, 72, 136, 96)}{limb(118, 72, 136, 112)}{limb(70, 72, 48, 48)}{arrow(48, 48, 40, 34)}</Figure>
    case 'hinge':
      return <Figure label={name}>{head(84, 38)}{torso(88, 50, 118, 74)}{limb(118, 74, 112, 112)}{limb(118, 74, 132, 112)}{limb(96, 58, 122, 78)}{arrow(118, 74, 134, 74)}</Figure>
    case 'hipflexor':
      return <Figure label={name}>{head(96, 36)}{torso(96, 48, 100, 84)}{limb(100, 84, 76, 112)}{limb(100, 84, 124, 96)}{limb(124, 96, 142, 112)}{limb(96, 56, 78, 78)}{arrow(100, 84, 112, 84)}</Figure>
    case 'glutestretch':
      return <Figure label={name}>{head(52, 92)}{torso(64, 98, 108, 98)}{limb(108, 98, 126, 82)}{limb(108, 98, 96, 112)}{limb(96, 112, 118, 96)}{arrow(118, 96, 130, 88)}</Figure>
    case 'hamstring':
      return <Figure label={name}>{head(52, 94)}{torso(64, 100, 108, 100)}{limb(108, 100, 128, 76)}{limb(108, 100, 96, 112)}{arrow(128, 76, 136, 62)}</Figure>
    case 'catcow':
      return <Figure label={name}>{head(58, 58)}{torso(70, 66, 118, 66)}{limb(70, 66, 58, 96)}{limb(70, 66, 58, 112)}{limb(118, 66, 136, 96)}{limb(118, 66, 136, 112)}{arrow(94, 66, 94, 50)}</Figure>
    case 'band':
      return <Figure label={name}>{head(100, 36)}{torso(100, 48, 100, 88)}{limb(100, 56, 66, 62)}{limb(100, 56, 134, 62)}{limb(100, 88, 90, 112)}{limb(100, 88, 110, 112)}<line x1="66" y1="62" x2="134" y2="62" stroke="#dc2626" strokeWidth="2" strokeDasharray="4 3" />{arrow(66, 62, 54, 62)}{arrow(134, 62, 146, 62)}</Figure>
    case 'abduction':
      return <Figure label={name}>{head(52, 88)}{torso(64, 94, 104, 94)}{limb(104, 94, 136, 94)}{limb(104, 94, 128, 76)}{arrow(128, 76, 136, 62)}</Figure>
    case 'sittostand':
      return <Figure label={name}><rect x="118" y="78" width="34" height="8" rx="3" fill="#94a3b8" /><line x1="146" y1="86" x2="146" y2="112" stroke="#94a3b8" strokeWidth="4" />{head(96, 40)}{torso(98, 52, 110, 82)}{limb(110, 82, 102, 112)}{limb(110, 82, 122, 112)}{arrow(110, 82, 110, 64)}</Figure>
    case 'bandwalk':
      return <Figure label={name}>{head(96, 36)}{torso(96, 48, 100, 84)}{limb(100, 84, 88, 112)}{limb(100, 84, 112, 112)}{limb(96, 56, 80, 74)}{limb(96, 56, 112, 74)}{arrow(112, 112, 128, 112)}</Figure>
    case 'balance':
      return <Figure label={name}>{head(100, 36)}{torso(100, 48, 100, 86)}{limb(100, 56, 78, 72)}{limb(100, 56, 122, 72)}{limb(100, 86, 96, 112)}{limb(100, 86, 112, 96)}{arrow(100, 86, 112, 78)}</Figure>
    case 'walk':
    default:
      return <Figure label={name}>{head(92, 34)}{torso(94, 46, 98, 80)}{limb(98, 80, 78, 102)}{limb(78, 102, 66, 112)}{limb(98, 80, 118, 100)}{limb(118, 100, 130, 112)}{limb(96, 54, 76, 70)}{limb(96, 54, 116, 66)}{arrow(130, 112, 148, 112)}</Figure>
  }
}
