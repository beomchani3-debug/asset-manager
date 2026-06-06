import { useState, useMemo, useEffect } from 'react'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import useTransactionStore from '../store/useTransactionStore'
import useSettingsStore from '../store/useSettingsStore'
import usePriceStore from '../store/usePriceStore'

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
const MARKETS = ['전체', '미국', '국내', '일본', '코인']
const SORTS   = ['평가금액순', '수익률순', '종목명순']

const MARKET_BADGE_STYLE = {
  '미국': 'bg-blue-50 text-blue-600',
  '국내': 'bg-emerald-50 text-emerald-600',
  '일본': 'bg-red-50 text-red-500',
  '코인': 'bg-amber-50 text-amber-600',
}

const MARKET_COLOR = {
  '미국': '#3B82F6',
  '국내': '#10B981',
  '일본': '#EF4444',
  '코인': '#F59E0B',
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, isMarket = false }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
      isMarket ? (MARKET_BADGE_STYLE[label] ?? 'bg-slate-100 text-slate-500') : 'bg-slate-100 text-slate-500'
    }`}>
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 text-[12px] leading-relaxed pointer-events-none">
      <p className="font-bold text-slate-800">{d.name}</p>
      <p className="text-slate-500">{d.ticker} · {d.market}</p>
      <p className="font-semibold text-slate-700">{fmtKrw(d.size)}</p>
      {d.hasPrice && (
        <p className={d.pnlPct >= 0 ? 'text-blue-600 font-semibold' : 'text-red-500 font-semibold'}>
          {d.pnlPct >= 0 ? '+' : ''}{d.pnlPct.toFixed(2)}%
        </p>
      )}
    </div>
  )
}

// ─── HoldingCard ──────────────────────────────────────────────────────────────
function HoldingCard({ holding, onClick }) {
  const { hasPrice, priceEntry, marketValue, unrealizedPnl, pnlPct } = holding
  const up = unrealizedPnl >= 0

  return (
    <div
      onClick={onClick}
      className="rounded-2xl bg-white shadow-sm border border-slate-100 p-4 active:bg-slate-50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[15px] font-bold text-slate-900 leading-snug">{holding.assetName}</span>
            <span className="text-xs font-mono text-slate-400">{holding.ticker}</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Badge label={holding.market} isMarket />
            {holding.sector && <Badge label={holding.sector} />}
            <Badge label={holding.broker} />
          </div>
        </div>
        <div className="shrink-0 ml-2">
          {hasPrice ? (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              up ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'
            }`}>
              {fmtPct(pnlPct)}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">미조회</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 py-3 border-y border-slate-50 mb-3">
        <div>
          <p className="text-[10px] text-slate-400 mb-0.5">현재가</p>
          <p className="text-xs font-semibold text-slate-800 tabular-nums">
            {hasPrice ? fmtPrice(priceEntry.price, holding.currency) : '—'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 mb-0.5">보유수량</p>
          <p className="text-xs font-semibold text-slate-800 tabular-nums">{fmtQty(holding.quantity)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 mb-0.5">평균단가</p>
          <p className="text-xs font-semibold text-slate-800 tabular-nums">
            {fmtPrice(holding.avgPrice, holding.currency)}
          </p>
        </div>
      </div>

      {hasPrice ? (
        <div className="flex items-baseline justify-between">
          <span className="text-base font-bold text-slate-900 tabular-nums">{fmtKrw(marketValue)}</span>
          <span className={`text-sm font-semibold tabular-nums ${up ? 'text-blue-600' : 'text-red-500'}`}>
            {fmtKrwSigned(unrealizedPnl)}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
            가격 미조회 · 수동 입력 필요
          </span>
          <span className="text-xs text-slate-400 tabular-nums">원금 {fmtKrw(holding.principal)}</span>
        </div>
      )}
    </div>
  )
}

// ─── DetailModal ──────────────────────────────────────────────────────────────
function DetailModal({ holding, transactions, onClose }) {
  const [show, setShow]             = useState(false)
  const [priceInput, setPriceInput] = useState('')

  const setManualPrice = useSettingsStore((s) => s.setManualPrice)
  const setPrice       = usePriceStore((s) => s.setPrice)
  const hasManualPrice = useSettingsStore((s) => s.settings.manualPrices[holding.ticker] != null)
  const manualPrice    = useSettingsStore((s) => s.settings.manualPrices[holding.ticker])

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const close = () => { setShow(false); setTimeout(onClose, 300) }

  const buyHistory = useMemo(() =>
    transactions
      .filter((t) => t.ticker === holding.ticker && t.broker === holding.broker && t.side === '매수')
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [transactions, holding.ticker, holding.broker]
  )

  const divHistory = useMemo(() =>
    transactions
      .filter((t) => t.ticker === holding.ticker && t.side === '배당')
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [transactions, holding.ticker]
  )

  const handleSavePrice = () => {
    const p = parseFloat(priceInput)
    if (isNaN(p) || p <= 0) return
    setManualPrice(holding.ticker, p)
    setPrice(holding.ticker, p, holding.currency)
    setPriceInput('')
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
      />
      <div
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px]
                   bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto no-scrollbar
                   transition-transform duration-300 ease-out ${show ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-5 pt-2 pb-10">
          <div className="flex items-start justify-between mb-5">
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-slate-900 mb-1.5 truncate">{holding.assetName}</h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-mono text-slate-400">{holding.ticker}</span>
                <Badge label={holding.market} isMarket />
                {holding.sector && <Badge label={holding.sector} />}
                <Badge label={holding.broker} />
              </div>
            </div>
            <button
              onClick={close}
              aria-label="닫기"
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm shrink-0 ml-3 active:opacity-70"
            >
              ✕
            </button>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 mb-5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-semibold text-slate-600">현재가 수동 입력</p>
              {hasManualPrice && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  수동가 적용 · {fmtPrice(manualPrice, holding.currency)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder={`현재가 입력 (${holding.currency})`}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors"
              />
              <button
                onClick={handleSavePrice}
                disabled={!priceInput || parseFloat(priceInput) <= 0}
                className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 active:opacity-80 transition-opacity"
              >
                저장
              </button>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              매수 이력 ({buyHistory.length}건)
            </p>
            {buyHistory.length > 0 ? (
              <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-5 px-3 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400">
                  {['날짜', '수량', '단가', '환율', '원화'].map((h, i) => (
                    <span key={h} className={i > 0 ? 'text-right' : ''}>{h}</span>
                  ))}
                </div>
                {buyHistory.map((tx) => (
                  <div key={tx.id} className="grid grid-cols-5 px-3 py-2.5 border-t border-slate-50 text-[11px] tabular-nums">
                    <span className="text-slate-500">{tx.date.slice(5)}</span>
                    <span className="text-right text-slate-700">{fmtQty(tx.quantity)}</span>
                    <span className="text-right text-slate-700">{fmtPrice(tx.price, tx.currency)}</span>
                    <span className="text-right text-slate-400">
                      {tx.currency === 'KRW' ? '—' : Math.round(tx.fxRate).toLocaleString('ko-KR')}
                    </span>
                    <span className="text-right text-slate-700">
                      {Math.round(tx.krwAmount).toLocaleString('ko-KR')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-slate-400 py-3">매수 이력 없음</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              배당 이력 ({divHistory.length}건)
            </p>
            {divHistory.length > 0 ? (
              <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-2 px-3 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400">
                  <span>날짜</span>
                  <span className="text-right">수령액 (원화)</span>
                </div>
                {divHistory.map((tx) => (
                  <div key={tx.id} className="grid grid-cols-2 px-3 py-2.5 border-t border-slate-50 text-[11px] tabular-nums">
                    <span className="text-slate-500">{tx.date}</span>
                    <span className="text-right text-emerald-600 font-semibold">
                      {Math.round(tx.krwAmount).toLocaleString('ko-KR')}원
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-2 px-3 py-2.5 border-t border-slate-200 bg-slate-50 text-[11px] tabular-nums">
                  <span className="font-semibold text-slate-600">합계</span>
                  <span className="text-right font-bold text-emerald-600">
                    {Math.round(divHistory.reduce((s, t) => s + t.krwAmount, 0)).toLocaleString('ko-KR')}원
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-slate-400 py-3">배당 이력 없음</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Portfolio ────────────────────────────────────────────────────────────────
export default function Portfolio() {
  const [marketFilter, setMarketFilter] = useState('전체')
  const [sortBy, setSortBy]             = useState('평가금액순')
  const [view, setView]                 = useState('카드')
  const [selected, setSelected]         = useState(null)

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

  const { totalMV, totalPrin, totalPnl } = useMemo(() => {
    const mv   = enriched.reduce((s, h) => s + h.marketValue, 0)
    const prin = enriched.reduce((s, h) => s + h.principal, 0)
    return { totalMV: mv, totalPrin: prin, totalPnl: mv - prin }
  }, [enriched])

  // 트리맵 데이터: 크기순 정렬 (큰 항목이 상단 좌측에 배치)
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
    <div className="flex flex-col h-full">

      {/* ── 필터 바 ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-4 pt-3 pb-2.5 space-y-2.5">
        {/* 시장 필터 + 정렬 */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
            {MARKETS.map((m) => (
              <button
                key={m}
                onClick={() => setMarketFilter(m)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  marketFilter === m
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="shrink-0 text-[11px] text-slate-600 bg-slate-100 rounded-lg px-2 py-1.5 outline-none border-0"
          >
            {SORTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* 뷰 전환 */}
        <div className="flex gap-1.5">
          {['카드', '트리맵'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-colors ${
                view === v ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
              }`}
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
            displayed.map((h) => (
              <HoldingCard
                key={`${h.ticker}::${h.broker}`}
                holding={h}
                onClick={() => setSelected(h)}
              />
            ))
          ) : holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">📊</div>
              <p className="text-[15px] font-semibold text-slate-600">보유 종목이 없습니다</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                거래기록에서 매수를 추가하면<br />여기에 종목이 표시됩니다
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-slate-400">해당 시장의 보유 종목이 없습니다</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden p-3">
          {treemapData.length > 0 ? (
            <>
              {/* 시장별 범례 */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                {Object.entries(MARKET_COLOR).map(([market, color]) => (
                  <div key={market} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-[11px] text-slate-500">{market}</span>
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
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">📊</div>
              <p className="text-[15px] font-semibold text-slate-600">표시할 종목이 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* ── 하단 요약 바 ─────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-t border-slate-100 px-4 py-3">
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          {[
            { label: '평가금액', value: fmtKrw(totalMV),        color: 'text-slate-800'                                 },
            { label: '투자원금', value: fmtKrw(totalPrin),      color: 'text-slate-800'                                 },
            { label: '총 손익',  value: fmtKrwSigned(totalPnl), color: totalPnl >= 0 ? 'text-blue-600' : 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center px-2 first:pl-0 last:pr-0">
              <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
              <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 상세 모달 ────────────────────────────────────────────────────── */}
      {selected && (
        <DetailModal
          holding={selected}
          transactions={transactions}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
