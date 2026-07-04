import { useEffect } from 'react'
import useFixedExpenseStore from '../store/useFixedExpenseStore'
import useCashFlowStore from '../store/useCashFlowStore'
import useAuthStore from '../store/useAuthStore'
import { currentYearMonth, monthsBetween, resolveRecurringDate } from '../utils/date'

export function useFixedExpenseAutoInsert() {
  const userId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function run() {
      const now      = new Date()
      const todayDay = now.getDate()
      const thisYM   = currentYearMonth()

      const { fixedExpenses, isInserted, markInserted } = useFixedExpenseStore.getState()
      const { addCashFlow } = useCashFlowStore.getState()

      for (const fe of fixedExpenses) {
        if (cancelled || !fe.isActive) continue

        const startYM = (fe.createdAt ?? now.toISOString()).slice(0, 7)
        for (const ym of monthsBetween(startYM, thisYM)) {
          if (cancelled || isInserted(ym, fe.id)) continue

          const [year, month] = ym.split('-').map(Number)
          const date = resolveRecurringDate(year, month, fe.day)

          if (ym === thisYM) {
            const resolvedDay = Number(date.slice(8, 10))
            if (resolvedDay > todayDay) continue
          }

          await addCashFlow({
            date,
            type: '고정비',
            category: fe.name,
            amount: fe.amount,
            memo: '',
            recurringId: fe.id,
          })
          if (!cancelled) markInserted(ym, fe.id)
        }
      }
    }

    run().catch(console.error)
    return () => { cancelled = true }
  }, [userId])
}
