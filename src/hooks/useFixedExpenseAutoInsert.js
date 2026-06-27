import { useEffect } from 'react'
import useFixedExpenseStore from '../store/useFixedExpenseStore'
import useCashFlowStore from '../store/useCashFlowStore'
import useAuthStore from '../store/useAuthStore'

export function useFixedExpenseAutoInsert() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user) return

    const now = new Date()
    const todayDay = now.getDate()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const yearMonth = `${year}-${month}`

    const { fixedExpenses, isInserted, markInserted } = useFixedExpenseStore.getState()
    const { addCashFlow } = useCashFlowStore.getState()

    for (const fe of fixedExpenses) {
      if (!fe.isActive) continue
      if (fe.day > todayDay) continue
      if (isInserted(yearMonth, fe.id)) continue

      const day = String(fe.day).padStart(2, '0')
      addCashFlow({
        date:     `${year}-${month}-${day}`,
        type:     '고정비',
        category: fe.name,
        amount:   fe.amount,
        memo:     '',
      })
      markInserted(yearMonth, fe.id)
    }
  }, [user])
}
