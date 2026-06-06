import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useExpenseStore = create(
  persist(
    (set, get) => ({
      expenses: [],

      addExpense: (expense) =>
        set({
          expenses: [...get().expenses, { ...expense, id: crypto.randomUUID() }],
        }),

      updateExpense: (id, updates) =>
        set({
          expenses: get().expenses.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        }),

      deleteExpense: (id) =>
        set({
          expenses: get().expenses.filter((e) => e.id !== id),
        }),
    }),
    { name: 'expenses-storage' }
  )
)

export default useExpenseStore
