import useSettingsStore from '../store/useSettingsStore'

// CORS 허용, API 키 불필요 (무료, 분당 1500회 제한)
const FX_URL = 'https://open.er-api.com/v6/latest/USD'

/**
 * USD/KRW 환율을 조회하고 useSettingsStore에 저장한다.
 * 실패 시 기존 환율 유지, null 반환.
 */
export async function fetchFxRates() {
  try {
    const res = await fetch(FX_URL)
    if (!res.ok) throw new Error(`FX API ${res.status}`)

    const json = await res.json()
    if (json.result !== 'success') throw new Error(`FX API: ${json['error-type']}`)

    const { rates } = json
    if (!rates?.KRW) throw new Error('Missing KRW in response')

    const USD = rates.KRW

    await useSettingsStore.getState().updateSettings({
      fxRates: { ...useSettingsStore.getState().settings.fxRates, USD },
      fxRatesUpdatedAt: new Date().toISOString(),
    })

    return { USD }
  } catch (err) {
    console.warn(`[fxService] ${err.message}`)
    return null
  }
}
