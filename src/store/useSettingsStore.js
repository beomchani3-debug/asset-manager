import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { upsertSettings } from '../services/supabaseSync'

const DEFAULT_SETTINGS = {
  dividendGoalKrw: 1_000_000,
  fxRates: { USD: 0, JPY: 0 },
  manualPrices: {},
  cashFlowCategories: null, // null → CashFlow uses built-in defaults
  cashFlowCatIcons: {}, // 카테고리 이름 → 이모지 (사용자가 추가/변경한 아이콘)
}

const useSettingsStore = create(
  persist(
    (set, get) => ({
      /** @type {import('../types').Settings} */
      settings: { ...DEFAULT_SETTINGS },

      /** settings 최상위 필드 일괄 업데이트 */
      updateSettings: (updates) => {
        const next = { ...get().settings, ...updates }
        set({ settings: next })
        upsertSettings(next).catch(console.error)
      },

      /** 특정 통화 환율 업데이트 */
      setFxRate: (currency, rate) => {
        const next = {
          ...get().settings,
          fxRates: { ...get().settings.fxRates, [currency]: rate },
        }
        set({ settings: next })
        upsertSettings(next).catch(console.error)
      },

      /** 종목 수동 현재가 등록·수정 */
      setManualPrice: (ticker, price) => {
        const next = {
          ...get().settings,
          manualPrices: { ...get().settings.manualPrices, [ticker]: price },
        }
        set({ settings: next })
        upsertSettings(next).catch(console.error)
      },

      /** 종목 수동 현재가 삭제 */
      clearManualPrice: (ticker) => {
        const { [ticker]: _removed, ...rest } = get().settings.manualPrices
        const next = { ...get().settings, manualPrices: rest }
        set({ settings: next })
        upsertSettings(next).catch(console.error)
      },

      setCashFlowCategories: (cats, icons) => {
        const next = {
          ...get().settings,
          cashFlowCategories: cats,
          ...(icons ? { cashFlowCatIcons: { ...get().settings.cashFlowCatIcons, ...icons } } : {}),
        }
        set({ settings: next })
        upsertSettings(next).catch(console.error)
      },

      resetSettings: () => {
        set({ settings: { ...DEFAULT_SETTINGS } })
        upsertSettings({ ...DEFAULT_SETTINGS }).catch(console.error)
      },

      /** Supabase에서 불러온 설정으로 스토어를 교체한다 */
      loadFromCloud: (settings) => {
        set({ settings: { ...DEFAULT_SETTINGS, ...settings } })
      },
    }),
    { name: 'settings-v2' }
  )
)

export default useSettingsStore
