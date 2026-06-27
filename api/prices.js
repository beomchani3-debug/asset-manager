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

async function yahooFetch(symbol) {
  const signal = AbortSignal.timeout(8000)
  for (const base of [YAHOO_BASE, YAHOO_ALT]) {
    try {
      const url = `${base}/${encodeURIComponent(symbol)}?interval=1d&range=1d`
      const res = await fetch(url, { headers: YAHOO_HEADERS, signal })
      if (!res.ok) {
        console.warn(`[api/prices] ${base} → ${res.status} for ${symbol}`)
        continue
      }
      const json = await res.json()
      const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (price != null) return price
      const chartErr = json?.chart?.error
      throw new Error(chartErr ? `${chartErr.code}: ${chartErr.description}` : 'No price in response')
    } catch (e) {
      if (e.name === 'TimeoutError') throw new Error(`Timeout for ${symbol}`)
      if (base === YAHOO_ALT) throw e
    }
  }
  throw new Error(`Yahoo Finance: no data for ${symbol}`)
}

async function fetchSingle(ticker, market) {
  const symbol = toYahooSymbol(ticker, market)
  const price  = await yahooFetch(symbol)
  return { price, currency: marketToCurrency(market) }
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
        console.log(`[api/prices] ✓ ${ticker} (${marketList[i]}): ${data[ticker].price} ${data[ticker].currency}`)
      } catch (err) {
        console.error(`[api/prices] ✗ ${ticker} (${marketList[i]}): ${err.message}`)
        failed.push({ ticker, reason: err.message })
      }
    })
  )

  return res.status(200).json({ data, failed })
}
