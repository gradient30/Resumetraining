import { useState } from 'react'
import { login, register, resetPassword } from '../api'
import type { AuthUser } from '../api'

export default function AuthScreen({ onDone }: { onDone: (u: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newConfirm, setNewConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  function switchMode(next: 'login' | 'register' | 'forgot') {
    setError('')
    setNotice('')
    setMode(next)
  }

  async function submit() {
    setError('')
    setNotice('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('邮箱格式不对，检查一下')
      return
    }
    if (mode === 'forgot') {
      if (!/^\d{6}$/.test(code.trim())) {
        setError('重置码是 6 位数字')
        return
      }
      if (newPassword.length < 8) {
        setError('新密码至少 8 位，建议含字母+数字')
        return
      }
      if (newPassword !== newConfirm) {
        setError('两次输入的新密码不一致')
        return
      }
      setBusy(true)
      try {
        await resetPassword(email.trim(), code.trim(), newPassword)
        setNotice('密码已重置，请用新密码登录')
        setPassword('')
        setCode('')
        setNewPassword('')
        setNewConfirm('')
        setMode('login')
      } catch (e) {
        setError(e instanceof Error ? e.message : '出了点问题，再试一次')
      } finally {
        setBusy(false)
      }
      return
    }
    // 登录不拦截 <8 位密码：旧账号注册时只要求 ≥6 位，登录页的
    // <8 拦截会让旧密码永远登不上；≥8 位只要求注册和重置新密码。
    if (!password) {
      setError('请输入密码')
      return
    }
    if (mode === 'register') {
      if (password.length < 8) {
        setError('密码至少 8 位，建议含字母+数字')
        return
      }
      if (password !== confirm) {
        setError('两次输入的密码不一致')
        return
      }
    }
    setBusy(true)
    try {
      const u = mode === 'login' ? await login(email.trim(), password) : await register(email.trim(), password)
      onDone(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : '出了点问题，再试一次')
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'login' ? '登录你的账号' : mode === 'register' ? '注册一个账号' : '找回密码'
  const heading = mode === 'login' ? '登录' : mode === 'register' ? '注册' : '重置密码'

  return (
    <div className="app">
      <header className="hero">
        <p className="hero-date">健康恢复阶段性训练</p>
        <h1>{title}</h1>
        <p className="hero-sub">每个账号有自己独立的档案、打卡和腰围记录，别人登录自己的账号，看不到你的数据。</p>
      </header>

      <div className="card">
        <h2>{heading}</h2>
        <label className="muted">邮箱</label>
        <input
          type="email"
          placeholder="name@example.com"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode === 'forgot' ? (
          <>
            <label className="muted">6 位重置码</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="请输入 6 位数字重置码"
              value={code}
              autoComplete="one-time-code"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <p className="muted" style={{ margin: '4px 0 10px' }}>
              重置码由管理员提供（暂无邮件发送）：请先联系管理员获取 6 位重置码，15 分钟内有效。
            </p>
            <label className="muted">新密码（至少 8 位，建议含字母+数字）</label>
            <input
              type="password"
              placeholder="请输入新密码"
              value={newPassword}
              autoComplete="new-password"
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <label className="muted">再输一次新密码</label>
            <input
              type="password"
              placeholder="请再输入一次新密码"
              value={newConfirm}
              autoComplete="new-password"
              onChange={(e) => setNewConfirm(e.target.value)}
            />
          </>
        ) : (
          <>
            <label className="muted">
              {mode === 'register' ? '密码（至少 8 位，建议含字母+数字）' : '密码'}
            </label>
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
          </>
        )}
        {notice && (
          <p style={{ margin: '4px 0 10px', color: '#1a7f37' }}>{notice}</p>
        )}
        {error && (
          <p className="danger" style={{ margin: '4px 0 10px' }}>
            {error}
          </p>
        )}
        <button className="primary" disabled={busy} onClick={submit}>
          {busy ? '请稍等…' : mode === 'login' ? '登录' : mode === 'register' ? '注册并登录' : '重置密码'}
        </button>
        <p className="muted" style={{ marginTop: 12, textAlign: 'center' }}>
          {mode === 'login' ? (
            <>
              还没有账号？
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  switchMode('register')
                }}
              >
                去注册
              </a>
              {' · '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  switchMode('forgot')
                }}
              >
                忘记密码？
              </a>
            </>
          ) : mode === 'register' ? (
            <>
              已有账号？
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  switchMode('login')
                }}
              >
                直接登录
              </a>
            </>
          ) : (
            <>
              想起密码了？
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  switchMode('login')
                }}
              >
                回到登录
              </a>
            </>
          )}
        </p>
      </div>

      <p className="muted">
        {mode === 'login'
          ? '请使用注册邮箱登录。'
          : mode === 'register'
            ? '请使用邮箱注册账号。'
            : '请使用注册邮箱重置密码。'}
      </p>
    </div>
  )
}
