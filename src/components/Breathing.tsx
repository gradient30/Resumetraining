import { useEffect, useRef, useState } from 'react'

// Breathing trainer: inhale 4s, hold 2s, exhale 6s. Diaphragmatic breathing.
const PHASES = [
  { label: '吸气', seconds: 4 },
  { label: '屏住', seconds: 2 },
  { label: '呼气', seconds: 6 },
]

export default function Breathing() {
  const [running, setRunning] = useState(false)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [left, setLeft] = useState(4)
  const [cycles, setCycles] = useState(0)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    timer.current = window.setInterval(() => {
      setLeft((prev) => {
        if (prev > 1) return prev - 1
        setPhaseIdx((idx) => {
          const next = (idx + 1) % PHASES.length
          if (next === 0) setCycles((c) => c + 1)
          setLeft(PHASES[next].seconds)
          return next
        })
        return prev
      })
    }, 1000)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [running])

  const phase = PHASES[phaseIdx]
  return (
    <div className="card">
      <h2>呼吸跟练 · 吸 4 – 屏 2 – 呼 6</h2>
      <p className="muted">睡前或训练开始前做 5 次缓慢腹式呼吸：手放肚子上，吸气肚子鼓起，呼气慢慢放下。发力时轻轻收紧腹部，不要憋气。</p>
      <p className="big-num" style={{ margin: '8px 0' }}>{running ? `${phase.label} · ${left} 秒` : '准备好就开始'}</p>
      <p className="muted">已完成 {cycles} 轮</p>
      <button className="primary" onClick={() => { setRunning(!running); if (!running) { setPhaseIdx(0); setLeft(4) } }}>{running ? '暂停' : '开始跟练'}</button>
    </div>
  )
}
