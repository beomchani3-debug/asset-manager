import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { T } from '../theme'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      navigate('/', { replace: true })
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

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: T.bg }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💼</div>
          <h1 className="text-[22px] font-bold" style={{ color: T.goldLight }}>자산관리</h1>
          <p className="text-[13px] mt-1" style={{ color: T.textMuted }}>로그인하여 시작하세요</p>
        </div>
        <form
          onSubmit={handleLogin}
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
              placeholder="••••••••"
              required
              autoComplete="current-password"
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
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>
        <p className="text-center text-[12px] mt-4" style={{ color: T.textMuted }}>
          계정이 없으신가요?{' '}
          <Link to="/register" className="font-semibold" style={{ color: T.gold }}>회원가입</Link>
        </p>
      </div>
    </div>
  )
}
