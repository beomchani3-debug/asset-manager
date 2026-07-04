import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import useTransactionStore from '../store/useTransactionStore'
import useSettingsStore from '../store/useSettingsStore'
import usePriceStore from '../store/usePriceStore'
import { calcPnL } from '../utils/pnl'
import { T, MARKET_COLOR } from '../theme'

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtKrw = (n) => `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
const fmtKrwSigned = (n) =>
  `${n >= 0 ? '+' : '-'}${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

function fmtPrice(price, currency) {
  if (price == null) return '—'
  if (currency === 'KRW') return `₩${Math.round(price).toLocaleString('ko-KR')}`
  if (currency === 'USD')
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (currency === 'JPY') return `¥${Math.round(price).toLocaleString('ja-JP')}`
  return String(price)
}

function fmtQty(qty) {
  return qty === Math.floor(qty)
    ? Math.round(qty).toLocaleString('ko-KR')
    : qty.toLocaleString('en-US', { maximumFractionDigits: 8 })
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MARKETS = ['전체', '미국', '국내']
const SORTS   = ['평가금액순', '수익률순', '종목명순']

const MARKET_BADGE_STYLE = {
  '미국': { backgroundColor: '#0A1525', color: T.blue   },
  '국내': { backgroundColor: '#0D1A0D', color: T.green  },
  '일본': { backgroundColor: '#200A0A', color: T.red    },
  '코인': { backgroundColor: '#1A1400', color: T.gold   },
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, isMarket = false }) {
  const style = isMarket
    ? (MARKET_BADGE_STYLE[label] ?? { backgroundColor: T.inputBg, color: T.textMuted })
    : { backgroundColor: T.inputBg, color: T.textMuted }
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={style}
    >
      {label}
    </span>
  )
}

// ─── Treemap cell renderer ────────────────────────────────────────────────────
function TreeCell(props) {
  const { x, y, width, height, name, ticker, market, pnlPct, hasPrice } = props
  const color = MARKET_COLOR[market] ?? '#94A3B8'
  const showFull  = width > 64 && height > 44
  const showSmall = width > 32 && height > 24

  return (
    <g>
      <rect
        x={x + 1} y={y + 1}
        width={width - 2} height={height - 2}
        fill={color} rx={6} fillOpacity={0.88}
      />
      {showFull && (
        <>
          <text
            x={x + width / 2} y={y + height / 2 - 7}
            textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={12} fontWeight="700"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {name.length > 9 ? name.slice(0, 8) + '…' : name}
          </text>
          <text
            x={x + width / 2} y={y + height / 2 + 9}
            textAnchor="middle" dominantBaseline="middle"
            fill="rgba(255,255,255,0.85)" fontSize={10}
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {hasPrice ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%` : '미조회'}
          </text>
        </>
      )}
      {!showFull && showSmall && (
        <text
          x={x + width / 2} y={y + height / 2}
          textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={9} fontWeight="700"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {ticker.length > 5 ? ticker.slice(0, 4) : ticker}
        </text>
      )}
    </g>
  )
}

// ─── Treemap tooltip ──────────────────────────────────────────────────────────
function TreeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      className="rounded-xl shadow-lg px-3 py-2.5 text-[12px] leading-relaxed pointer-events-none"
      style={{ backgroundColor: T.card, border: `1px solid ${T.gold}`, color: T.textPrimary }}
    >
      <p className="font-bold">{d.name}</p>
      <p style={{ color: T.textMuted }}>{d.ticker} · {d.market}</p>
      <p className="font-semibold">{fmtKrw(d.size)}</p>
      {d.hasPrice && (
        <p style={{ color: d.pnlPct >= 0 ? T.green : T.red, fontWeight: 600 }}>
          {d.pnlPct >= 0 ? '+' : ''}{d.pnlPct.toFixed(2)}%
        </p>
      )}
    </div>
  )
}

// ─── HoldingCard ──────────────────────────────────────────────────────────────
function HoldingCard({ holding, onClick, realizedPnl, divInfo }) {
  const { hasPrice, priceEntry, marketValue, unrealizedPnl, pnlPct } = holding
  const up = unrealizedPnl >= 0

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-4 active:opacity-80 transition-opacity cursor-pointer"
      style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[15px] font-bold leading-snug" style={{ color: T.textPrimary }}>{holding.assetName}</span>
            <span className="text-xs font-mono" style={{ color: T.textMuted }}>{holding.ticker}</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Badge label={holding.market} isMarket />
            {holding.sector && <Badge label={holding.sector} />}
            <Badge label={holding.broker} />
          </div>
        </div>
        <div className="shrink-0 ml-2">
          {hasPrice ? (
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: up ? 'rgba(76,175,80,0.15)' : 'rgba(224,82,82,0.15)', color: up ? T.green : T.red }}
            >
              {fmtPct(pnlPct)}
            </span>
          ) : (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: T.inputBg, color: T.textMuted }}
            >
              미조회
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 py-3 mb-3" style={{ borderTop: `1px solid ${T.divider}`, borderBottom: `1px solid ${T.divider}` }}>
        <div>
          <p className="text-[10px] mb-0.5" style={{ color: T.textMuted }}>현재가</p>
          <p className="text-xs font-semibold tabular-nums" style={{ color: T.textPrimary }}>
            {hasPrice ? fmtPrice(priceEntry.price, holding.currency) : '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] mb-0.5" style={{ color: T.textMuted }}>보유수량</p>
          <p className="text-xs font-semibold tabular-nums" style={{ color: T.textPrimary }}>{fmtQty(holding.quantity)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] mb-0.5" style={{ color: T.textMuted }}>평균단가</p>
          <p className="text-xs font-semibold tabular-nums" style={{ color: T.textPrimary }}>
            {fmtPrice(holding.avgPrice, holding.currency)}
          </p>
        </div>
      </div>

      {hasPrice ? (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold tabular-nums" style={{ color: T.goldLight }}>{fmtKrw(marketValue)}</span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: up ? T.green : T.red }}>
              {fmtKrwSigned(unrealizedPnl)}
            </span>
          </div>
          <div className="mt-2 h-1 rounded-sm overflow-hidden" style={{ backgroundColor: '#1C1C1C', borderRadius: 2 }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.abs(pnlPct) / 20 * 100)}%`,
                backgroundColor: up ? T.gold : T.red,
                borderRadius: 2,
              }}
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-lg"
            style={{ color: T.amber, backgroundColor: 'rgba(245,158,11,0.1)', border: `1px solid ${T.amber}` }}
          >
            현재가 조회 실패 · 수동 입력 필요
          </span>
          <span className="text-xs tabular-nums" style={{ color: T.textMuted }}>원금 {fmtKrw(holding.principal)}</span>
        </div>
      )}
      {realizedPnl !== 0 && (
        <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: `1px solid ${T.divider}` }}>
          <span className="text-[10px]" style={{ color: T.textMuted }}>실현손익</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: realizedPnl > 0 ? T.green : T.red }}>
            {fmtKrwSigned(realizedPnl)}
          </span>
        </div>
      )}
      {divInfo && divInfo.annualKrw > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${T.divider}` }}>
          <span className="text-[11px] tabular-nums" style={{ color: T.textMuted }}>
            연 배당 {divInfo.yieldPct.toFixed(1)}% · 월 예상 ₩{Math.round(divInfo.monthlyKrw).toLocaleString('ko-KR')}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Portfolio ────────────────────────────────────────────────────────────────
export default function Portfolio() {
  const navigate = useNavigate()
  const [marketFilter, setMarketFilter] = useState('전체')
  const [sortBy, setSortBy]             = useState('평가금액순')
  const [view, setView]                 = useState('카드')

  const holdings     = useTransactionStore((s) => s.holdings)
  const transactions = useTransactionStore((s) => s.transactions)
  const fxUSD        = useSettingsStore((s) => s.settings.fxRates.USD)
  const fxJPY        = useSettingsStore((s) => s.settings.fxRates.JPY)
  const prices       = usePriceStore((s) => s.prices)

  const enriched = useMemo(() =>
    holdings.map((h) => {
      const entry = prices[h.ticker]
      if (!entry) {
        return { ...h, hasPrice: false, priceEntry: null, marketValue: h.principal, unrealizedPnl: 0, pnlPct: 0 }
      }
      let fx = 1
      if      (h.currency === 'USD') fx = fxUSD > 0 ? fxUSD : h.avgFxRate
      else if (h.currency === 'JPY') fx = fxJPY > 0 ? fxJPY : h.avgFxRate
      const marketValue   = h.quantity * entry.price * fx
      const unrealizedPnl = marketValue - h.principal
      const pnlPct        = h.principal > 0 ? (unrealizedPnl / h.principal) * 100 : 0
      return { ...h, hasPrice: true, priceEntry: entry, marketValue, unrealizedPnl, pnlPct }
    }),
    [holdings, prices, fxUSD, fxJPY]
  )

  const displayed = useMemo(() => {
    const base = marketFilter === '전체' ? enriched : enriched.filter((h) => h.market === marketFilter)
    if (sortBy === '평가금액순') return [...base].sort((a, b) => b.marketValue - a.marketValue)
    if (sortBy === '수익률순')   return [...base].sort((a, b) => b.pnlPct - a.pnlPct)
    if (sortBy === '종목명순')   return [...base].sort((a, b) => a.assetName.localeCompare(b.assetName, 'ko'))
    return base
  }, [enriched, marketFilter, sortBy])

  const pnlByTicker = useMemo(() => calcPnL(transactions).byTicker, [transactions])

  // 최근 12개월 배당 합계 per ticker (yield, 월 예상)
  const divByTicker = useMemo(() => {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    const cutoffStr = [
      cutoff.getFullYear(),
      String(cutoff.getMonth() + 1).padStart(2, '0'),
      String(cutoff.getDate()).padStart(2, '0'),
    ].join('-')

    const map = {}
    for (const tx of transactions) {
      if (tx.side !== '배당' || tx.date < cutoffStr) continue
      map[tx.ticker] = (map[tx.ticker] ?? 0) + tx.krwAmount
    }
    return map
  }, [transactions])

  const { totalMV, totalPrin, totalPnl } = useMemo(() => {
    const mv   = enriched.reduce((s, h) => s + h.marketValue, 0)
    const prin = enriched.reduce((s, h) => s + h.principal, 0)
    return { totalMV: mv, totalPrin: prin, totalPnl: mv - prin }
  }, [enriched])

  const treemapData = useMemo(() =>
    displayed
      .filter((h) => h.marketValue > 0)
      .sort((a, b) => b.marketValue - a.marketValue)
      .map((h) => ({
        name:        h.assetName,
        ticker:      h.ticker,
        market:      h.market,
        size:        h.marketValue,
        pnlPct:      h.pnlPct,
        hasPrice:    h.hasPrice,
      })),
    [displayed]
  )

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: T.bg }}>

      {/* ── 필터 바 ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 pt-3 pb-2.5 space-y-2.5 border-b"
        style={{ backgroundColor: T.card, borderColor: T.gold }}
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
            {MARKETS.map((m) => (
              <button
                key={m}
                onClick={() => setMarketFilter(m)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={marketFilter === m
                  ? { backgroundColor: T.gold, color: '#0A0A0A' }
                  : { backgroundColor: T.inputBg, color: T.textMuted }
                }
              >
                {m}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="shrink-0 text-[11px] rounded-lg px-2 py-1.5 outline-none border-0"
            style={{ backgroundColor: T.inputBg, color: T.textMuted }}
          >
            {SORTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex gap-1.5">
          {['카드', '트리맵'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1 rounded-lg text-[12px] font-semibold transition-colors"
              style={view === v
                ? { backgroundColor: T.goldDim, color: T.goldLight }
                : { backgroundColor: T.inputBg, color: T.textMuted }
              }
            >
              {v === '카드' ? '⊞ 카드' : '▦ 트리맵'}
            </button>
          ))}
        </div>
      </div>

      {/* ── 메인 영역 ─────────────────────────────────────────────────────── */}
      {view === '카드' ? (
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
          {displayed.length > 0 ? (
            displayed.map((h) => {
              const annualKrw  = divByTicker[h.ticker] ?? 0
              const mv         = h.marketValue > 0 ? h.marketValue : h.principal
              const yieldPct   = mv > 0 ? (annualKrw / mv) * 100 : 0
              const monthlyKrw = annualKrw / 12
              const divInfo    = annualKrw > 0 ? { annualKrw, yieldPct, monthlyKrw } : null
              return (
                <HoldingCard
                  key={`${h.ticker}::${h.broker}`}
                  holding={h}
                  onClick={() => navigate(`/portfolio/${encodeURIComponent(h.ticker)}?broker=${encodeURIComponent(h.broker)}`)}
                  realizedPnl={pnlByTicker[`${h.ticker}::${h.broker}`] ?? 0}
                  divInfo={divInfo}
                />
              )
            })
          ) : holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>📊</div>
              <p className="text-[15px] font-semibold" style={{ color: T.textPrimary }}>보유 종목이 없습니다</p>
              <p className="text-sm leading-relaxed" style={{ color: T.textMuted }}>
                거래기록에서 매수를 추가하면<br />여기에 종목이 표시됩니다
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm" style={{ color: T.textMuted }}>해당 시장의 보유 종목이 없습니다</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden p-3">
          {treemapData.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                {Object.entries(MARKET_COLOR).filter(([m]) => m === '미국' || m === '국내').map(([market, color]) => (
                  <div key={market} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-[11px]" style={{ color: T.textMuted }}>{market}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: 'calc(100% - 28px)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={treemapData}
                    dataKey="size"
                    aspectRatio={4 / 3}
                    content={<TreeCell />}
                  >
                    <Tooltip content={<TreeTooltip />} />
                  </Treemap>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>📊</div>
              <p className="text-[15px] font-semibold" style={{ color: T.textPrimary }}>표시할 종목이 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* ── 하단 요약 바 ─────────────────────────────────────────────────── */}
      <div
        className="shrink-0 border-t px-4 py-3"
        style={{ backgroundColor: T.card, borderColor: T.gold }}
      >
        <div className="grid grid-cols-3">
          {[
            { label: '평가금액', value: fmtKrw(totalMV),        color: T.goldLight                           },
            { label: '투자원금', value: fmtKrw(totalPrin),      color: T.textPrimary                         },
            { label: '총 손익',  value: fmtKrwSigned(totalPnl), color: totalPnl >= 0 ? T.green : T.red       },
          ].map(({ label, value, color }, i) => (
            <div
              key={label}
              className="text-center px-2 first:pl-0 last:pr-0"
              style={i > 0 ? { borderLeft: `1px solid ${T.divider}` } : {}}
            >
              <p className="text-[10px] mb-0.5" style={{ color: T.textMuted }}>{label}</p>
              <p className="text-sm font-bold tabular-nums" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
