import useSettingsStore from '../store/useSettingsStore'

// ─── Constants ────────────────────────────────────────────────────────────────
// CORS 허용, API 키 불필요 (무료 플랜, 분당 1500회 제한)
const FX_URL = 'https://open.er-api.com/v6/latest/USD'

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * USD/KRW 와 JPY/KRW 환율을 조회하고 useSettingsStore에 저장한다.
 *
 * open.er-api 응답은 USD 기준이므로:
 *   USD/KRW = rates.KRW
 *   JPY/KRW = rates.KRW / rates.JPY  (1엔당 원화)
 *
 * 조회 실패 시 스토어의 기존 환율을 유지하고 null 반환.
 *
 * @returns {Promise<{ USD: number, JPY: number } | null>}
 */
export async function fetchFxRates() {
  try {
    const res = await fetch(FX_URL)
    if (!res.ok) throw new Error(`FX API ${res.status}`)

    const json = await res.json()
    if (json.result !== 'success') throw new Error(`FX API: ${json['error-type']}`)

    const { rates } = json
    if (!rates?.KRW || !rates?.JPY) throw new Error('Missing KRW or JPY in response')

    const USD = rates.KRW
    const JPY = rates.KRW / rates.JPY

    useSettingsStore.getState().updateSettings({
      fxRates: { USD, JPY },
      fxRatesUpdatedAt: new Date().toISOString(),
    })

    return { USD, JPY }
  } catch (err) {
    // 실패 시 기존 저장 환율 유지 (덮어쓰지 않음)
    console.warn(`[fxService] ${err.message}`)
    return null
  }
}
