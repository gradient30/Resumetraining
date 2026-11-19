import { useState } from 'react'
import { login, register } from '../api'
import type { AuthUser } from '../api'

export default function AuthScreen({ onDone }: { onDone: (u: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('邮箱格式不对，检查一下')
      return
    }
    if (password.length < 8) {
      setError('密码至少 8 位，建议含字母+数字')
      return
    }
    if (mode === 'register' && password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setBusy(true)
    try {
      const u =
        mode === 'login'
          ? await login(email.trim(), password)
          : await register(email.trim(), password)
      onDone(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : '出了点问题，再试一次')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <p className="hero-date">健康恢复阶段性训练</p>
        <h1>{mode === 'login' ? '登录你的账号' : '注册一个账号'}</h1>
        <p className="hero-sub">每个账号有自己独立的档案、打卡和腰围记录，别人登录自己的账号，看不到你的数据。</p>
      </header>

      <div className="card">
        <h2>{mode === 'login' ? '登录' : '注册'}</h2>
        <label className="muted">{mode === 'register' ? '邮箱（只用来登录，暂不验证）' : '邮箱（用来登录，不验证）'}</label>
        <input
          type="email"
          placeholder="name@example.com"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="muted">密码（至少 8 位，建议含字母+数字）</label>
        <input
          type="password"
          placeholder="请输入密码"
          value={password}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === 'register' && (
          <>
            <label className="muted">再输一次密码</label>
            <input
              type="password"
              placeholder="请再输入一次密码"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
            />
            <p className="muted" style={{ margin: '4px 0 10px' }}>
              注册确认：密码至少 8 位，建议含字母+数字。
            </p>
          </>
        )}
        {error && (
          <p className="danger" style={{ margin: '4px 0 10px' }}>
            {error}
          </p>
        )}
        <button className="primary" disabled={busy} onClick={submit}>
          {busy ? '请稍等…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
        <p className="muted" style={{ marginTop: 12, textAlign: 'center' }}>
          {mode === 'login' ? (
            <>
              还没有账号？
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setError('')
                  setMode('register')
                }}
              >
                去注册
              </a>
            </>
          ) : (
            <>
              已有账号？
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setError('')
                  setMode('login')
                }}
              >
                直接登录
              </a>
            </>
          )}
        </p>
      </div>

      <p className="muted">
        注册不需要验证邮箱，邮箱只用来登录。登录有效期 30 天，到期后重新登录一次。
        同一台设备退出登录后，浏览器里的缓存数据会一起清除，不会留给下一个账号。
        {mode === 'login' && '忘记密码请联系管理员重置（暂无自助找回）。'}
      </p>
    </div>
  )
}
