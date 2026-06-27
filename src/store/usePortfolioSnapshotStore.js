import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const usePortfolioSnapshotStore = create(
  persist(
    (set, get) => ({
      /** { 'YYYY-MM': number } — yearMonth → total KRW market value */
      snapshots: {},

      saveSnapshot: (ym, value) => {
        if (value <= 0) return
        set({ snapshots: { ...get().snapshots, [ym]: value } })
      },
    }),
    { name: 'portfolio-snapshots-v1' }
  )
)

export default usePortfolioSnapshotStore
