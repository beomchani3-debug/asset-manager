import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useFixedExpenseStore = create(
  persist(
    (set, get) => ({
      /** @type {{ id: string, name: string, amount: number, day: number, isActive: boolean, createdAt: string }[]} */
      fixedExpenses: [],

      /** { 'YYYY-MM': string[] } — inserted fixed expense IDs per month */
      insertedLog: {},

      addFixedExpense: (fe) => {
        const item = { ...fe, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
        set({ fixedExpenses: [...get().fixedExpenses, item] })
      },

      updateFixedExpense: (id, updates) => {
        set({
          fixedExpenses: get().fixedExpenses.map((fe) =>
            fe.id === id ? { ...fe, ...updates } : fe
          ),
        })
      },

      deleteFixedExpense: (id) => {
        set({ fixedExpenses: get().fixedExpenses.filter((fe) => fe.id !== id) })
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
    }),
    { name: 'fixed-expenses-v1' }
  )
)

export default useFixedExpenseStore
