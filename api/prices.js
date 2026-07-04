// Vercel serverless: server-side proxy for Yahoo Finance
// Browser → /api/prices → Yahoo (no CORS issues)

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'
const YAHOO_ALT  = 'https://query2.finance.yahoo.com/v8/finance/chart'

const YAHOO_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin':          'https://finance.yahoo.com',
  'Referer':         'https://finance.yahoo.com/',
  'Cache-Control':   'no-cache',
}

function toYahooSymbol(ticker, market) {
  if (ticker.includes('.')) return ticker
  if (market === '국내') return `${ticker}.KS`
  return ticker
}

function marketToCurrency(market) {
  if (market === '국내') return 'KRW'
  return 'USD'
}

// 종목당 캐시 (같은 서버리스 인스턴스가 재사용되는 동안만 유효, 콜드스타트 시 초기화됨)
const CACHE_TTL_MS = 5 * 60 * 1000
const priceCache = new Map() // symbol -> { price, currency, cachedAt }

async function yahooFetch(symbol) {
  const signal = AbortSignal.timeout(8000)
  for (const base of [YAHOO_BASE, YAHOO_ALT]) {
    try {
      const url = `${base}/${encodeURIComponent(symbol)}?interval=1d&range=1d`
      const res = await fetch(url, { headers: YAHOO_HEADERS, signal })
      if (!res.ok) {
        // 임시 상세 로깅: 실제 실패 원인(429 rate-limit, 999 차단 등) 확인용
        const bodySnippet = await res.text().then((t) => t.slice(0, 300)).catch(() => '(no body)')
        console.warn(`[api/prices] ${base} → HTTP ${res.status} ${res.statusText} for ${symbol}: ${bodySnippet}`)
        continue
      }
      const json = await res.json()
      const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (price != null) return price
      const chartErr = json?.chart?.error
      console.warn(`[api/prices] ${base} → 200 OK but no price for ${symbol}:`, JSON.stringify(json).slice(0, 300))
      throw new Error(chartErr ? `${chartErr.code}: ${chartErr.description}` : 'No price in response')
    } catch (e) {
      console.warn(`[api/prices] ${base} → exception for ${symbol}: ${e.name}: ${e.message}`)
      if (e.name === 'TimeoutError') throw new Error(`Timeout for ${symbol}`)
      if (base === YAHOO_ALT) throw e
    }
  }
  throw new Error(`Yahoo Finance: no data for ${symbol}`)
}

async function fetchSingle(ticker, market) {
  const symbol   = toYahooSymbol(ticker, market)
  const currency = marketToCurrency(market)

  const cached = priceCache.get(symbol)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { price: cached.price, currency, fromCache: true }
  }

  const price = await yahooFetch(symbol)
  priceCache.set(symbol, { price, cachedAt: Date.now() })
  return { price, currency, fromCache: false }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  const { tickers, markets } = req.query
  if (!tickers || !markets) {
    return res.status(400).json({ error: 'tickers and markets query params are required' })
  }

  const tickerList = tickers.split(',').map((t) => t.trim()).filter(Boolean)
  const marketList = markets.split(',').map((m) => m.trim()).filter(Boolean)

  if (tickerList.length !== marketList.length) {
    return res.status(400).json({ error: 'tickers and markets must have the same length' })
  }

  const data   = {}
  const failed = []

  await Promise.all(
    tickerList.map(async (ticker, i) => {
      try {
        data[ticker] = await fetchSingle(ticker, marketList[i])
        const { price, currency, fromCache } = data[ticker]
        console.log(`[api/prices] ✓ ${ticker} (${marketList[i]}): ${price} ${currency}${fromCache ? ' (cache)' : ''}`)
      } catch (err) {
        console.error(`[api/prices] ✗ ${ticker} (${marketList[i]}): ${err.message}`)
        failed.push({ ticker, market: marketList[i], reason: err.message })
      }
    })
  )

  return res.status(200).json({ data, failed })
}
