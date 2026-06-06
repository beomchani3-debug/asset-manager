import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const usePriceStore = create(
  persist(
    (set, get) => ({
      /** @type {{ [ticker: string]: { price: number, currency: string, updatedAt: string } }} */
      prices: {},
      isLoading: false,
      error: null,

      /** 단일 종목 현재가 등록·수정 */
      setPrice: (ticker, price, currency) =>
        set({
          prices: {
            ...get().prices,
            [ticker]: { price, currency, updatedAt: new Date().toISOString() },
          },
        }),

      /**
       * 여러 종목 현재가 일괄 등록
       * @param {{ [ticker: string]: { price: number, currency: string } }} priceMap
       */
      setPrices: (priceMap) => {
        const now = new Date().toISOString()
        const updates = Object.fromEntries(
          Object.entries(priceMap).map(([ticker, { price, currency }]) => [
            ticker,
            { price, currency, updatedAt: now },
          ])
        )
        set({ prices: { ...get().prices, ...updates } })
      },

      /** 특정 종목의 현재가 엔트리 반환 (없으면 null) */
      getPrice: (ticker) => get().prices[ticker] ?? null,

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      clearPrices: () => set({ prices: {} }),
    }),
    {
      name: 'prices-v2',
      // isLoading·error는 UI 상태이므로 영속화 제외
      partialize: (state) => ({ prices: state.prices }),
    }
  )
)

export default usePriceStore
