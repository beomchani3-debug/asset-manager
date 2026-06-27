import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useDividendScheduleStore = create(
  persist(
    (set, get) => ({
      /**
       * { [ticker]: { assetName, period, months, day, amountKrw } }
       * period: '월배당' | '분기배당' | '반기배당' | '연배당'
       * months: number[]  e.g. [1,2,...12] or [3,6,9,12]
       */
      schedules: {},

      setSchedule: (ticker, sched) =>
        set({ schedules: { ...get().schedules, [ticker]: sched } }),

      removeSchedule: (ticker) => {
        const { [ticker]: _, ...rest } = get().schedules
        set({ schedules: rest })
      },
    }),
    { name: 'dividend-schedules-v1' }
  )
)

export default useDividendScheduleStore
