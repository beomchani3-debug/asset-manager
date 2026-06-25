import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { T } from '../theme'

export default function Register() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(false)
  const [loading,  setLoading]  = useState(false)

  async function handleRegister(e) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inpStyle = {
    backgroundColor: T.inputBg,
    borderColor: T.inputBorder,
    color: T.textPrimary,
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: T.bg }}
      >
        <div
          className="w-full max-w-sm text-center rounded-2xl p-8"
          style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}
        >
          <div className="text-4xl mb-4">✉️</div>
          <h2 className="text-[18px] font-bold mb-2" style={{ color: T.goldLight }}>이메일을 확인하세요</h2>
          <p className="text-[13px] mb-6" style={{ color: T.textMuted }}>
            <span className="font-semibold" style={{ color: T.textPrimary }}>{email}</span>으로<br />확인 링크를 보냈습니다
          </p>
          <Link
            to="/login"
            className="block w-full py-3 text-[14px] font-bold rounded-xl text-center"
            style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
          >
            로그인으로 이동
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: T.bg }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💼</div>
          <h1 className="text-[22px] font-bold" style={{ color: T.goldLight }}>회원가입</h1>
          <p className="text-[13px] mt-1" style={{ color: T.textMuted }}>새 계정을 만드세요</p>
        </div>
        <form
          onSubmit={handleRegister}
          className="rounded-2xl p-6 space-y-4"
          style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}
        >
          <div>
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: T.textMuted }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-[14px] outline-none transition-colors focus:border-[#C9A84C]"
              style={inpStyle}
              placeholder="email@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: T.textMuted }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-[14px] outline-none transition-colors focus:border-[#C9A84C]"
              style={inpStyle}
              placeholder="6자 이상"
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: T.textMuted }}>비밀번호 확인</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-[14px] outline-none transition-colors focus:border-[#C9A84C]"
              style={inpStyle}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p
              className="text-[12px] rounded-xl px-3 py-2"
              style={{ color: T.red, backgroundColor: 'rgba(224,82,82,0.1)', border: `1px solid ${T.red}` }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-[14px] font-bold rounded-xl active:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
          >
            {loading ? '가입 중…' : '가입하기'}
          </button>
        </form>
        <p className="text-center text-[12px] mt-4" style={{ color: T.textMuted }}>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="font-semibold" style={{ color: T.gold }}>로그인</Link>
        </p>
      </div>
    </div>
  )
}
