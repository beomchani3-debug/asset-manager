import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useDividendStore = create(
  persist(
    (set, get) => ({
      dividends: [],

      addDividend: (div) =>
        set({
          dividends: [...get().dividends, { ...div, id: crypto.randomUUID() }],
        }),

      updateDividend: (id, updates) =>
        set({
          dividends: get().dividends.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        }),

      deleteDividend: (id) =>
        set({
          dividends: get().dividends.filter((d) => d.id !== id),
        }),
    }),
    { name: 'dividends-storage' }
  )
)

export default useDividendStore
