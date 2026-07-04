import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  insertCashFlow,
  updateCashFlowRow,
  deleteCashFlowRow,
  clearCashFlows,
} from '../services/supabaseSync'

const useCashFlowStore = create(
  persist(
    (set, get) => ({
      /** @type {import('../types').CashFlow[]} */
      cashFlows: [],

      addCashFlow: (cf) => {
        const newCf = { ...cf, id: crypto.randomUUID() }
        set({ cashFlows: [...get().cashFlows, newCf] })
        insertCashFlow(newCf).catch(console.error)
      },

      updateCashFlow: (id, updates) => {
        const merged = { ...get().cashFlows.find(c => c.id === id), ...updates }
        set({
          cashFlows: get().cashFlows.map((c) =>
            c.id === id ? merged : c
          ),
        })
        updateCashFlowRow(id, merged).catch(console.error)
      },

      deleteCashFlow: (id) => {
        set({ cashFlows: get().cashFlows.filter((c) => c.id !== id) })
        deleteCashFlowRow(id).catch(console.error)
      },

      /**
       * 특정 월(YYYY-MM)의 수입 / 고정비 / 변동지출 합계를 반환한다.
       * @param {string} yearMonth  예: "2026-06"
       * @returns {{ income: number, fixed: number, variable: number }}
       */
      getMonthlySummary: (yearMonth) => {
        const flows = get().cashFlows.filter((c) => c.date.startsWith(yearMonth))
        return {
          income: flows
            .filter((c) => c.type === '수입')
            .reduce((s, c) => s + c.amount, 0),
          fixed: flows
            .filter((c) => c.type === '고정비')
            .reduce((s, c) => s + c.amount, 0),
          variable: flows
            .filter((c) => c.type === '변동지출')
            .reduce((s, c) => s + c.amount, 0),
        }
      },

      /**
       * 특정 월(YYYY-MM)의 카테고리별 지출 합계를 반환한다.
       * @param {string} yearMonth
       * @returns {{ [category: string]: number }}
       */
      getMonthlyCategoryBreakdown: (yearMonth) => {
        const flows = get().cashFlows.filter(
          (c) => c.date.startsWith(yearMonth) && c.type !== '수입'
        )
        return flows.reduce((acc, c) => {
          acc[c.category] = (acc[c.category] ?? 0) + c.amount
          return acc
        }, {})
      },

      clearAll: () => {
        set({ cashFlows: [] })
        clearCashFlows().catch(console.error)
      },

      /** 삭제된 반복(고정비) 항목을 참조하던 recurringId를 전부 지운다 */
      clearRecurringId: (feId) => {
        const cashFlows = get().cashFlows.map((c) => {
          if (c.recurringId !== feId) return c
          const { recurringId: _removed, ...rest } = c
          updateCashFlowRow(c.id, rest).catch(console.error)
          return rest
        })
        set({ cashFlows })
      },

      /** Supabase에서 불러온 데이터로 스토어를 교체한다 */
      loadFromCloud: (cashFlows) => {
        set({ cashFlows })
      },
    }),
    { name: 'cashflows-v1' }
  )
)

export default useCashFlowStore
