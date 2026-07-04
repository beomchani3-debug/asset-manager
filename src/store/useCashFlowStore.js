import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  insertCashFlow,
  updateCashFlowRow,
  deleteCashFlowRow,
  clearCashFlows,
} from '../services/supabaseSync'
import { isSupabaseConfigured } from '../lib/supabase'

function mergeById(localItems, cloudItems) {
  const merged = new Map()
  for (const item of localItems) merged.set(item.id, item)
  for (const item of cloudItems) merged.set(item.id, { ...merged.get(item.id), ...item })
  return [...merged.values()]
}

async function syncIfConfigured(action) {
  if (!isSupabaseConfigured) return
  await action()
}

const useCashFlowStore = create(
  persist(
    (set, get) => ({
      /** @type {import('../types').CashFlow[]} */
      cashFlows: [],

      addCashFlow: async (cf) => {
        const newCf = { ...cf, id: crypto.randomUUID() }
        const prev = get().cashFlows
        set({ cashFlows: [...prev, newCf] })
        try {
          await syncIfConfigured(() => insertCashFlow(newCf))
          return newCf
        } catch (err) {
          set({ cashFlows: prev })
          throw err
        }
      },

      updateCashFlow: async (id, updates) => {
        const prev = get().cashFlows
        const merged = { ...get().cashFlows.find(c => c.id === id), ...updates }
        set({
          cashFlows: get().cashFlows.map((c) =>
            c.id === id ? merged : c
          ),
        })
        try {
          await syncIfConfigured(() => updateCashFlowRow(id, merged))
        } catch (err) {
          set({ cashFlows: prev })
          throw err
        }
      },

      deleteCashFlow: async (id) => {
        const prev = get().cashFlows
        set({ cashFlows: prev.filter((c) => c.id !== id) })
        try {
          await syncIfConfigured(() => deleteCashFlowRow(id))
        } catch (err) {
          set({ cashFlows: prev })
          throw err
        }
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

      clearAll: async () => {
        const prev = get().cashFlows
        set({ cashFlows: [] })
        try {
          await syncIfConfigured(() => clearCashFlows())
        } catch (err) {
          set({ cashFlows: prev })
          throw err
        }
      },

      /** 삭제된 반복(고정비) 항목을 참조하던 recurringId를 전부 지운다 */
      clearRecurringId: async (feId) => {
        const prev = get().cashFlows
        const updates = []
        const cashFlows = prev.map((c) => {
          if (c.recurringId !== feId) return c
          const rest = { ...c }
          delete rest.recurringId
          updates.push(rest)
          return rest
        })
        set({ cashFlows })
        try {
          await syncIfConfigured(() => Promise.all(updates.map((c) => updateCashFlowRow(c.id, c))))
        } catch (err) {
          set({ cashFlows: prev })
          throw err
        }
      },

      /** Supabase에서 불러온 데이터로 스토어를 교체한다 */
      loadFromCloud: (cashFlows) => {
        if (!Array.isArray(cashFlows) || cashFlows.length === 0) return
        set({ cashFlows: mergeById(get().cashFlows, cashFlows) })
      },
    }),
    { name: 'cashflows-v1' }
  )
)

export default useCashFlowStore
