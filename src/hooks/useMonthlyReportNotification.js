import { useEffect } from 'react'
import useAuthStore from '../store/useAuthStore'
import useToastStore from '../store/useToastStore'

export function useMonthlyReportNotification() {
  const user = useAuthStore((s) => s.user)
  const push = useToastStore((s) => s.push)

  useEffect(() => {
    if (!user) return
    const now = new Date()
    if (now.getDate() !== 1) return
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const y = prev.getFullYear()
    const m = prev.getMonth() + 1
    const timer = setTimeout(() => {
      push(`${y}년 ${m}월 리포트를 확인해보세요`, 'success')
    }, 3000)
    return () => clearTimeout(timer)
  }, [user])
}
