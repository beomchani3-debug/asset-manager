import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { upsertSettings } from '../services/supabaseSync'
import { isSupabaseConfigured } from '../lib/supabase'

const DEFAULT_SETTINGS = {
  dividendGoalKrw: 1_000_000,
  fxRates: { USD: 0, JPY: 0 },
  manualPrices: {},
  cashFlowCategories: null, // null → CashFlow uses built-in defaults
  cashFlowCatIcons: {}, // 카테고리 이름 → 이모지 (사용자가 추가/변경한 아이콘)
}

async function syncIfConfigured(action) {
  if (!isSupabaseConfigured) return
  await action()
}

const useSettingsStore = create(
  persist(
    (set, get) => ({
      /** @type {import('../types').Settings} */
      settings: { ...DEFAULT_SETTINGS },

      /** settings 최상위 필드 일괄 업데이트 */
      updateSettings: async (updates) => {
        const prev = get().settings
        const next = { ...get().settings, ...updates }
        set({ settings: next })
        try {
          await syncIfConfigured(() => upsertSettings(next))
        } catch (err) {
          set({ settings: prev })
          throw err
        }
      },

      /** 특정 통화 환율 업데이트 */
      setFxRate: async (currency, rate) => {
        const prev = get().settings
        const next = {
          ...get().settings,
          fxRates: { ...get().settings.fxRates, [currency]: rate },
        }
        set({ settings: next })
        try {
          await syncIfConfigured(() => upsertSettings(next))
        } catch (err) {
          set({ settings: prev })
          throw err
        }
      },

      /** 종목 수동 현재가 등록·수정 */
      setManualPrice: async (ticker, price) => {
        const prev = get().settings
        const next = {
          ...get().settings,
          manualPrices: { ...get().settings.manualPrices, [ticker]: price },
        }
        set({ settings: next })
        try {
          await syncIfConfigured(() => upsertSettings(next))
        } catch (err) {
          set({ settings: prev })
          throw err
        }
      },

      /** 종목 수동 현재가 삭제 */
      clearManualPrice: async (ticker) => {
        const prev = get().settings
        const rest = { ...get().settings.manualPrices }
        delete rest[ticker]
        const next = { ...get().settings, manualPrices: rest }
        set({ settings: next })
        try {
          await syncIfConfigured(() => upsertSettings(next))
        } catch (err) {
          set({ settings: prev })
          throw err
        }
      },

      setCashFlowCategories: async (cats, icons) => {
        const prev = get().settings
        const next = {
          ...get().settings,
          cashFlowCategories: cats,
          ...(icons ? { cashFlowCatIcons: { ...get().settings.cashFlowCatIcons, ...icons } } : {}),
        }
        set({ settings: next })
        try {
          await syncIfConfigured(() => upsertSettings(next))
        } catch (err) {
          set({ settings: prev })
          throw err
        }
      },

      resetSettings: async () => {
        const prev = get().settings
        set({ settings: { ...DEFAULT_SETTINGS } })
        try {
          await syncIfConfigured(() => upsertSettings({ ...DEFAULT_SETTINGS }))
        } catch (err) {
          set({ settings: prev })
          throw err
        }
      },

      /** Supabase에서 불러온 설정으로 스토어를 교체한다 */
      loadFromCloud: (settings) => {
        if (!settings) return
        set({ settings: { ...DEFAULT_SETTINGS, ...get().settings, ...settings } })
      },
    }),
    { name: 'settings-v2' }
  )
)

export default useSettingsStore
