import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

  const inpCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-blue-400 transition-colors'

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <div className="text-4xl mb-4">✉️</div>
          <h2 className="text-[18px] font-bold text-slate-800 mb-2">이메일을 확인하세요</h2>
          <p className="text-[13px] text-slate-400 mb-6">
            <span className="font-semibold text-slate-600">{email}</span>으로<br />확인 링크를 보냈습니다
          </p>
          <Link
            to="/login"
            className="block w-full py-3 bg-blue-600 text-white text-[14px] font-bold rounded-xl text-center"
          >
            로그인으로 이동
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💼</div>
          <h1 className="text-[22px] font-bold text-slate-800">회원가입</h1>
          <p className="text-[13px] text-slate-400 mt-1">새 계정을 만드세요</p>
        </div>
        <form onSubmit={handleRegister} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inpCls}
              placeholder="email@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inpCls}
              placeholder="6자 이상"
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">비밀번호 확인</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inpCls}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p className="text-[12px] text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white text-[14px] font-bold rounded-xl active:opacity-80 disabled:opacity-50"
          >
            {loading ? '가입 중…' : '가입하기'}
          </button>
        </form>
        <p className="text-center text-[12px] text-slate-400 mt-4">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-blue-600 font-semibold">로그인</Link>
        </p>
      </div>
    </div>
  )
}
