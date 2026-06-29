import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useBudgetStore = create(
  persist(
    (set, get) => ({
      budgets: {},
      setBudget: (category, amount) => {
        set({ budgets: { ...get().budgets, [category]: amount } })
      },
      setBudgets: (map) => {
        set({ budgets: { ...get().budgets, ...map } })
      },
    }),
    { name: 'category-budgets-v1' }
  )
)

export default useBudgetStore
