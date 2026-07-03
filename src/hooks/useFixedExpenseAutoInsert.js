import { useEffect } from 'react'
import useFixedExpenseStore from '../store/useFixedExpenseStore'
import useCashFlowStore from '../store/useCashFlowStore'
import useAuthStore from '../store/useAuthStore'
import { currentYearMonth, monthsBetween, resolveRecurringDate } from '../utils/date'

/**
 * 앱 실행 시점에 "지난 실행 이후 생성됐어야 할" 반복 고정비 내역을
 * 소급 생성한다. 매일 앱을 켜지 않아도 밀린 달만큼 한번에 채워진다.
 */
export function useFixedExpenseAutoInsert() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user) return

    const now      = new Date()
    const todayDay = now.getDate()
    const thisYM   = currentYearMonth()

    const { fixedExpenses, isInserted, markInserted } = useFixedExpenseStore.getState()
    const { addCashFlow } = useCashFlowStore.getState()

    for (const fe of fixedExpenses) {
      if (!fe.isActive) continue

      const startYM = (fe.createdAt ?? now.toISOString()).slice(0, 7)
      for (const ym of monthsBetween(startYM, thisYM)) {
        if (isInserted(ym, fe.id)) continue

        const [year, month] = ym.split('-').map(Number)
        const date = resolveRecurringDate(year, month, fe.day)

        // 이번달인 경우, 반복일이 아직 지나지 않았으면 스킵 (다음 실행 때 다시 시도)
        if (ym === thisYM) {
          const resolvedDay = Number(date.slice(8, 10))
          if (resolvedDay > todayDay) continue
        }

        addCashFlow({
          date,
          type:        '고정비',
          category:    fe.name,
          amount:      fe.amount,
          memo:        '',
          recurringId: fe.id,
        })
        markInserted(ym, fe.id)
      }
    }
  }, [user])
}
