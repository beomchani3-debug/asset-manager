import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import useCashFlowStore from './useCashFlowStore'

const useFixedExpenseStore = create(
  persist(
    (set, get) => ({
      /** @type {{ id: string, name: string, amount: number, day: number, isActive: boolean, createdAt: string }[]} */
      fixedExpenses: [],

      /** { 'YYYY-MM': string[] } — inserted fixed expense IDs per month */
      insertedLog: {},

      /** 반복 등록 제안을 무시한 카테고리명 목록 */
      dismissedSuggestions: [],

      addFixedExpense: (fe) => {
        const item = { ...fe, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
        set({ fixedExpenses: [...get().fixedExpenses, item] })
        return item
      },

      updateFixedExpense: (id, updates) => {
        set({
          fixedExpenses: get().fixedExpenses.map((fe) =>
            fe.id === id ? { ...fe, ...updates } : fe
          ),
        })
      },

      deleteFixedExpense: async (id) => {
        const prev = get().fixedExpenses
        set({ fixedExpenses: prev.filter((fe) => fe.id !== id) })
        try {
          await useCashFlowStore.getState().clearRecurringId(id)
        } catch (err) {
          set({ fixedExpenses: prev })
          throw err
        }
      },

      markInserted: (yearMonth, id) => {
        const log = get().insertedLog
        const existing = log[yearMonth] ?? []
        if (!existing.includes(id)) {
          set({ insertedLog: { ...log, [yearMonth]: [...existing, id] } })
        }
      },

      isInserted: (yearMonth, id) => {
        return (get().insertedLog[yearMonth] ?? []).includes(id)
      },

      dismissSuggestion: (name) => {
        const list = get().dismissedSuggestions
        if (!list.includes(name)) {
          set({ dismissedSuggestions: [...list, name] })
        }
      },
    }),
    { name: 'fixed-expenses-v1' }
  )
)

export default useFixedExpenseStore
