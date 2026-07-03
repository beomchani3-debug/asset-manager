import { useMemo } from 'react'
import useCashFlowStore from '../store/useCashFlowStore'
import useFixedExpenseStore from '../store/useFixedExpenseStore'

/**
 * 이름이 같은 "고정비" 내역이 2개월 이상 반복 등록된 경우
 * "반복으로 등록할까요?" 제안 목록을 반환한다.
 * 이미 반복 등록된 항목이거나, 사용자가 무시한 항목은 제외한다.
 */
export function useRecurringSuggestions() {
  const cashFlows          = useCashFlowStore((s) => s.cashFlows)
  const fixedExpenses      = useFixedExpenseStore((s) => s.fixedExpenses)
  const dismissedSuggestions = useFixedExpenseStore((s) => s.dismissedSuggestions)

  return useMemo(() => {
    const existingNames = new Set(fixedExpenses.map((fe) => fe.name))
    const byName = {}

    for (const cf of cashFlows) {
      if (cf.type !== '고정비' || cf.recurringId) continue
      const ym = cf.date.slice(0, 7)
      const bucket = (byName[cf.category] ??= { months: new Set(), entries: [] })
      bucket.months.add(ym)
      bucket.entries.push(cf)
    }

    return Object.entries(byName)
      .filter(([name, b]) => b.months.size >= 2 && !existingNames.has(name) && !dismissedSuggestions.includes(name))
      .map(([name, b]) => {
        const latest = [...b.entries].sort((a, c) => (c.date > a.date ? 1 : -1))[0]
        return {
          name,
          amount: latest.amount,
          day:    Number(latest.date.slice(8, 10)),
          months: b.months.size,
        }
      })
  }, [cashFlows, fixedExpenses, dismissedSuggestions])
}
