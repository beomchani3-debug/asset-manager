/**
 * 이동평균법 기반 실현손익 계산.
 * 배당(side==='배당')은 계산 제외.
 */
export function calcPnL(transactions) {
  const sorted = [...transactions]
    .filter(t => t.side !== '배당')
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const costMap = {}
  const realizedList = []

  for (const tx of sorted) {
    const key = `${tx.ticker}::${tx.broker}`
    if (!costMap[key]) {
      costMap[key] = { qty: 0, krwTotal: 0, assetName: tx.assetName, market: tx.market }
    }
    const cb = costMap[key]

    if (tx.side === '매수') {
      cb.qty      += tx.quantity
      cb.krwTotal += tx.krwAmount
    } else if (tx.side === '매도') {
      const avgCostKrw = cb.qty > 0 ? cb.krwTotal / cb.qty : 0
      const costKrw    = avgCostKrw * tx.quantity
      const pnl        = tx.krwAmount - costKrw

      realizedList.push({
        id:          tx.id,
        date:        tx.date,
        ticker:      tx.ticker,
        broker:      tx.broker,
        assetName:   tx.assetName,
        market:      tx.market,
        qty:         tx.quantity,
        proceedsKrw: tx.krwAmount,
        costKrw,
        pnl,
      })

      cb.krwTotal = Math.max(0, cb.krwTotal - costKrw)
      cb.qty      = Math.max(0, cb.qty - tx.quantity)
    }
  }

  const totalRealized = realizedList.reduce((s, r) => s + r.pnl, 0)

  const byTicker = {}
  const byMarket = {}
  const byMonth  = {}
  const byYear   = {}

  for (const r of realizedList) {
    const tkey = `${r.ticker}::${r.broker}`
    byTicker[tkey]     = (byTicker[tkey]     ?? 0) + r.pnl
    byMarket[r.market] = (byMarket[r.market] ?? 0) + r.pnl
    const ym = r.date.slice(0, 7)
    const yr = r.date.slice(0, 4)
    byMonth[ym] = (byMonth[ym] ?? 0) + r.pnl
    byYear[yr]  = (byYear[yr]  ?? 0) + r.pnl
  }

  return { realizedList, totalRealized, byTicker, byMarket, byMonth, byYear }
}
