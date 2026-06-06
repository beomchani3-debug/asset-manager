import usePriceStore from '../store/usePriceStore'
import useSettingsStore from '../store/useSettingsStore'

// ─── Constants ────────────────────────────────────────────────────────────────
const BINANCE_BASE = 'https://api.binance.com/api/v3/ticker/price'
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'
const CORS_PROXY = 'https://corsproxy.io/?'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const delay = (ms) => new Promise((res) => setTimeout(res, ms))

/** @param {'미국'|'국내'|'일본'|'코인'} market */
function marketToCurrency(market) {
  if (market === '국내') return 'KRW'
  if (market === '일본') return 'JPY'
  return 'USD' // 미국, 코인(USDT ≈ USD)
}

/** BTC → BTCUSDT, BTCUSDT → BTCUSDT */
function toBinanceSymbol(ticker) {
  const t = ticker.toUpperCase()
  return t.endsWith('USDT') ? t : `${t}USDT`
}

/** 379810 → 379810.KS / 8001 → 8001.T / AAPL → AAPL */
function toYahooTicker(ticker, market) {
  if (ticker.includes('.')) return ticker
  if (market === '국내') return `${ticker}.KS`
  if (market === '일본') return `${ticker}.T`
  return ticker
}

// ─── Raw fetchers (throws on failure) ─────────────────────────────────────────
async function fetchBinancePrice(ticker) {
  const symbol = toBinanceSymbol(ticker)
  const res = await fetch(`${BINANCE_BASE}?symbol=${symbol}`)
  if (!res.ok) throw new Error(`Binance ${res.status}: ${symbol}`)
  const { price } = await res.json()
  return parseFloat(price)
}

async function fetchYahooPrice(ticker, market) {
  const symbol = toYahooTicker(ticker, market)
  const yahooUrl = `${YAHOO_BASE}/${symbol}`
  const proxied = `${CORS_PROXY}${encodeURIComponent(yahooUrl)}`

  const res = await fetch(proxied)
  if (!res.ok) throw new Error(`Yahoo proxy ${res.status}: ${symbol}`)

  // corsproxy.io는 응답 본문을 직접 반환 (래핑 없음)
  const data = await res.json()
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
  if (price == null) throw new Error(`No regularMarketPrice for ${symbol}`)
  return price
}

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * 단일 종목 현재가를 조회하고 usePriceStore에 저장한다.
 *
 * - 수동 현재가(manualPrices)가 설정된 종목은 API 호출 없이 해당 값 사용
 * - 조회 실패 시 기존 저장값을 덮어쓰지 않고 null 반환
 *
 * @param {string} ticker
 * @param {'미국'|'국내'|'일본'|'코인'} market
 * @returns {Promise<number|null>}
 */
export async function fetchPrice(ticker, market) {
  const currency = marketToCurrency(market)

  // 수동 현재가 우선 적용
  const { settings } = useSettingsStore.getState()
  const manual = settings.manualPrices[ticker]
  if (manual != null) {
    usePriceStore.getState().setPrice(ticker, manual, currency)
    return manual
  }

  try {
    const price =
      market === '코인'
        ? await fetchBinancePrice(ticker)
        : await fetchYahooPrice(ticker, market)

    usePriceStore.getState().setPrice(ticker, price, currency)
    return price
  } catch (err) {
    // 실패 시 기존 저장값 유지 (덮어쓰지 않음)
    console.warn(`[priceService] ${ticker}: ${err.message}`)
    return null
  }
}

/**
 * 보유 종목 전체 현재가를 순차 조회한다 (rate limit 방지, 200ms 간격).
 *
 * - quantity > 0 인 종목만 조회
 * - 동일 ticker의 증권사 중복은 제거 후 1회만 호출
 *
 * @param {import('../types').Holding[]} holdings
 * @returns {Promise<void>}
 */
export async function fetchAllPrices(holdings) {
  const active = holdings.filter((h) => h.quantity > 0)
  if (!active.length) return

  // 동일 ticker 중복 제거 (첫 번째 등장 기준으로 market 정보 유지)
  const unique = [...new Map(active.map((h) => [h.ticker, h])).values()]

  for (let i = 0; i < unique.length; i++) {
    await fetchPrice(unique[i].ticker, unique[i].market)
    if (i < unique.length - 1) await delay(200)
  }
}
