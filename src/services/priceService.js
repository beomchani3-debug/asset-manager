import usePriceStore from '../store/usePriceStore'
import useSettingsStore from '../store/useSettingsStore'

function marketToCurrency(market) {
  if (market === '국내') return 'KRW'
  if (market === '일본') return 'JPY'
  return 'USD'
}

/**
 * 단일 종목 현재가 조회 → usePriceStore 저장.
 * 수동 가격 설정 시 API 호출 없이 저장값 사용.
 * 실패 시 null 반환 (기존 저장값 유지).
 */
export async function fetchPrice(ticker, market) {
  const currency = marketToCurrency(market)
  const { settings } = useSettingsStore.getState()
  const manual = settings.manualPrices?.[ticker]
  if (manual != null) {
    usePriceStore.getState().setPrice(ticker, manual, currency)
    return manual
  }

  try {
    const url = `/api/prices?tickers=${encodeURIComponent(ticker)}&markets=${encodeURIComponent(market)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json = await res.json()
    if (json.failed?.length) throw new Error(json.failed[0].reason)
    const entry = json.data?.[ticker]
    if (!entry) throw new Error('No data returned')
    usePriceStore.getState().setPrice(ticker, entry.price, entry.currency)
    return entry.price
  } catch (err) {
    console.warn(`[priceService] ${ticker}: ${err.message}`)
    return null
  }
}

/**
 * 보유 종목 전체 현재가 일괄 조회 (/api/prices 단일 호출).
 * 수동 가격 설정 종목은 즉시 적용, 나머지는 서버리스 함수로 일괄 요청.
 * @param {import('../types').Holding[]} holdings
 * @returns {Promise<{ failed: Array<{ ticker: string, reason: string }> }>}
 */
export async function fetchAllPrices(holdings) {
  const active = holdings.filter((h) => h.quantity > 0)
  if (!active.length) return { failed: [] }

  const unique = [...new Map(active.map((h) => [h.ticker, h])).values()]
  const manualPrices = useSettingsStore.getState().settings.manualPrices ?? {}

  // Apply manual prices immediately; collect tickers that need API fetch
  const toFetch = []
  for (const h of unique) {
    const manual = manualPrices[h.ticker]
    if (manual != null) {
      usePriceStore.getState().setPrice(h.ticker, manual, marketToCurrency(h.market))
    } else {
      toFetch.push(h)
    }
  }

  if (!toFetch.length) return { failed: [] }

  try {
    const tickers = toFetch.map((h) => h.ticker).join(',')
    const markets = toFetch.map((h) => h.market).join(',')
    const url = `/api/prices?tickers=${encodeURIComponent(tickers)}&markets=${encodeURIComponent(markets)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json = await res.json()

    for (const [ticker, entry] of Object.entries(json.data ?? {})) {
      usePriceStore.getState().setPrice(ticker, entry.price, entry.currency)
      console.info(`[priceService] ✓ ${ticker}: ${entry.price} ${entry.currency}`)
    }

    for (const { ticker, reason } of json.failed ?? []) {
      console.warn(`[priceService] ✗ ${ticker}: ${reason}`)
    }

    return { failed: json.failed ?? [] }
  } catch (err) {
    console.error('[priceService] batch fetch error:', err.message)
    return {
      failed: toFetch.map((h) => ({ ticker: h.ticker, reason: err.message })),
    }
  }
}
