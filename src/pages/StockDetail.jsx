import { useState, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import useTransactionStore from '../store/useTransactionStore'
import useSettingsStore from '../store/useSettingsStore'
import usePriceStore from '../store/usePriceStore'
import { calcPnL } from '../utils/pnl'
import { T } from '../theme'

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtKrw       = (n) => `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
const fmtKrwSigned = (n) => `${n >= 0 ? '+' : '-'}${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
const fmtPct       = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

function fmtPrice(price, currency) {
  if (price == null) return '—'
  if (currency === 'KRW') return `₩${Math.round(price).toLocaleString('ko-KR')}`
  if (currency === 'USD') return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (currency === 'JPY') return `¥${Math.round(price).toLocaleString('ja-JP')}`
  return String(price)
}

function fmtQty(qty) {
  return qty === Math.floor(qty)
    ? Math.round(qty).toLocaleString('ko-KR')
    : qty.toLocaleString('en-US', { maximumFractionDigits: 8 })
}

// ─── Shared small components ──────────────────────────────────────────────────
function StatItem({ label, value, valueStyle }) {
  return (
    <div>
      <p className="text-[10px] mb-0.5" style={{ color: T.textMuted }}>{label}</p>
      <p className="text-sm font-semibold tabular-nums" style={valueStyle ?? { color: T.textPrimary }}>{value}</p>
    </div>
  )
}

const SIDE_STYLE = {
  '매수': { bg: '#0A1525', text: T.blue  },
  '매도': { bg: '#200A0A', text: T.red   },
  '배당': { bg: '#0D1A0D', text: T.green },
}

// ─── StockDetail ─────────────────────────────────────────────────────────────
export default function StockDetail() {
  const { ticker } = useParams()
  const [searchParams] = useSearchParams()
  const broker   = searchParams.get('broker') ?? ''
  const navigate = useNavigate()

  const [tab,        setTab]        = useState('전체')
  const [priceInput, setPriceInput] = useState('')

  const holdings       = useTransactionStore((s) => s.holdings)
  const transactions   = useTransactionStore((s) => s.transactions)
  const fxUSD          = useSettingsStore((s) => s.settings.fxRates.USD)
  const fxJPY          = useSettingsStore((s) => s.settings.fxRates.JPY)
  const setManualPrice = useSettingsStore((s) => s.setManualPrice)
  const manualPrices   = useSettingsStore((s) => s.settings.manualPrices)
  const prices         = usePriceStore((s) => s.prices)
  const setPriceStore  = usePriceStore((s) => s.setPrice)

  // ── Holding ───────────────────────────────────────────────────────────────
  const holding = useMemo(() => {
    const decodedTicker = decodeURIComponent(ticker)
    return holdings.find(
      (h) => h.ticker === decodedTicker && (!broker || h.broker === broker)
    ) ?? null
  }, [holdings, ticker, broker])

  // ── Enriched holding (add price/PnL) ─────────────────────────────────────
  const enriched = useMemo(() => {
    if (!holding) return null
    const entry = prices[holding.ticker]
    if (!entry) return { ...holding, hasPrice: false, marketValue: holding.principal, unrealizedPnl: 0, pnlPct: 0 }
    let fx = 1
    if      (holding.currency === 'USD') fx = fxUSD > 0 ? fxUSD : holding.avgFxRate
    else if (holding.currency === 'JPY') fx = fxJPY > 0 ? fxJPY : holding.avgFxRate
    const marketValue   = holding.quantity * entry.price * fx
    const unrealizedPnl = marketValue - holding.principal
    const pnlPct        = holding.principal > 0 ? (unrealizedPnl / holding.principal) * 100 : 0
    return { ...holding, hasPrice: true, priceEntry: entry, marketValue, unrealizedPnl, pnlPct }
  }, [holding, prices, fxUSD, fxJPY])

  // ── Ticker transactions ───────────────────────────────────────────────────
  const tickerTxs = useMemo(() => {
    if (!holding) return []
    return transactions
      .filter((t) => t.ticker === holding.ticker && (!broker || t.broker === broker || t.side === '배당'))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [transactions, holding, broker])

  const filteredTxs = useMemo(() => {
    if (tab === '전체') return tickerTxs
    return tickerTxs.filter((t) => t.side === tab)
  }, [tickerTxs, tab])

  // ── PnL ──────────────────────────────────────────────────────────────────
  const pnlStats = useMemo(() => {
    const sameBrokerTxs = transactions.filter(
      (t) => t.ticker === (holding?.ticker ?? '') && t.broker === (holding?.broker ?? '')
    )
    return calcPnL(sameBrokerTxs)
  }, [transactions, holding])

  // ── Dividend summary ──────────────────────────────────────────────────────
  const dividends = useMemo(() => {
    const divTxs  = tickerTxs.filter((t) => t.side === '배당')
    const now     = new Date()
    const thisYM  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const thisYr  = String(now.getFullYear())
    const monthly = divTxs.filter((t) => t.date.startsWith(thisYM)).reduce((s, t) => s + t.krwAmount, 0)
    const annual  = divTxs.filter((t) => t.date.startsWith(thisYr)).reduce((s, t) => s + t.krwAmount, 0)
    const total   = divTxs.reduce((s, t) => s + t.krwAmount, 0)
    return { monthly, annual, total, count: divTxs.length }
  }, [tickerTxs])

  const manualPrice = holding ? manualPrices[holding.ticker] : null

  function handleSavePrice() {
    const p = parseFloat(priceInput)
    if (!holding || isNaN(p) || p <= 0) return
    setManualPrice(holding.ticker, p)
    setPriceStore(holding.ticker, p, holding.currency)
    setPriceInput('')
  }

  if (!holding || !enriched) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3" style={{ backgroundColor: T.bg }}>
        <p style={{ color: T.textMuted }}>종목을 찾을 수 없습니다</p>
        <button onClick={() => navigate('/portfolio')} className="text-sm font-medium" style={{ color: T.gold }}>
          ← 포트폴리오로
        </button>
      </div>
    )
  }

  const up = enriched.unrealizedPnl >= 0

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: T.bg }}>

      {/* 헤더 */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
        style={{ backgroundColor: T.card, borderColor: T.gold }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:opacity-70"
          style={{ backgroundColor: T.inputBg }}
          aria-label="뒤로"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: T.textMuted }}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-bold leading-tight truncate" style={{ color: T.goldLight }}>{enriched.assetName}</h1>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[11px] font-mono" style={{ color: T.textMuted }}>{enriched.ticker}</span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={enriched.market === '미국'
                ? { backgroundColor: '#0A1525', color: T.blue }
                : { backgroundColor: '#0D1A0D', color: T.green }
              }
            >
              {enriched.market}
            </span>
            {enriched.sector && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: T.inputBg, color: T.textMuted }}>
                {enriched.sector}
              </span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: T.inputBg, color: T.textMuted }}>
              {enriched.broker}
            </span>
          </div>
        </div>
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 pb-8">

        {/* ① 보유 현황 히어로 카드 */}
        <div
          className="rounded-2xl p-4 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #1C1500 0%, #2D2000 55%, #1A1400 100%)', border: `1px solid ${T.gold}` }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] mb-0.5" style={{ color: T.goldDim }}>평가금액</p>
              <p className="text-[1.75rem] font-bold leading-none tabular-nums" style={{ color: T.goldLight }}>
                {fmtKrw(enriched.marketValue)}
              </p>
            </div>
            {enriched.hasPrice ? (
              <span
                className="px-3 py-1.5 rounded-full text-[12px] font-bold shrink-0"
                style={{ backgroundColor: up ? 'rgba(76,175,80,0.2)' : 'rgba(224,82,82,0.2)', color: up ? T.green : T.red }}
              >
                {fmtPct(enriched.pnlPct)}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: T.inputBg, color: T.textMuted }}>
                미조회
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4" style={{ borderTop: `1px solid rgba(201,168,76,0.2)` }}>
            <StatItem label="현재가" value={enriched.hasPrice ? fmtPrice(enriched.priceEntry.price, enriched.currency) : '—'} />
            <StatItem label="평균단가" value={fmtPrice(enriched.avgPrice, enriched.currency)} />
            <StatItem label="보유수량" value={`${fmtQty(enriched.quantity)}주`} />
            <StatItem label="투자원금" value={fmtKrw(enriched.principal)} />
          </div>

          {enriched.hasPrice && (
            <div
              className="mt-4 pt-3 flex items-center justify-between"
              style={{ borderTop: `1px solid rgba(201,168,76,0.2)` }}
            >
              <span className="text-[11px]" style={{ color: T.textMuted }}>미실현손익</span>
              <span className="text-[15px] font-bold tabular-nums" style={{ color: up ? T.green : T.red }}>
                {fmtKrwSigned(enriched.unrealizedPnl)}
              </span>
            </div>
          )}
        </div>

        {/* ② 실현손익 */}
        {pnlStats.totalRealized !== 0 && (
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: T.card, border: `1px solid ${T.inputBorder}` }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>실현손익</p>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: T.textPrimary }}>총 실현손익</span>
              <span
                className="text-base font-bold tabular-nums"
                style={{ color: pnlStats.totalRealized >= 0 ? T.green : T.red }}
              >
                {fmtKrwSigned(pnlStats.totalRealized)}
              </span>
            </div>
          </div>
        )}

        {/* ③ 배당 현황 */}
        {dividends.count > 0 && (
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: T.card, border: `1px solid ${T.inputBorder}` }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>
              배당 현황 (총 {dividends.count}회)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '이번달', value: dividends.monthly, color: dividends.monthly > 0 ? T.green : T.textMuted },
                { label: '올해 누적', value: dividends.annual, color: T.textPrimary },
                { label: '전체 합계', value: dividends.total, color: T.goldLight },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-xl p-2.5 text-center"
                  style={{ backgroundColor: T.inputBg }}
                >
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>{label}</p>
                  <p className="text-[12px] font-bold tabular-nums" style={{ color }}>
                    ₩{Math.round(value).toLocaleString('ko-KR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ④ 거래 이력 */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-0.5" style={{ color: T.textMuted }}>
            거래 이력 ({tickerTxs.length}건)
          </p>
          {/* 탭 */}
          <div className="flex gap-1.5 mb-3">
            {['전체', '매수', '매도', '배당'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={tab === t
                  ? { backgroundColor: T.gold, color: '#0A0A0A' }
                  : { backgroundColor: T.inputBg, color: T.textMuted }
                }
              >
                {t}
              </button>
            ))}
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.inputBorder}` }}>
            {filteredTxs.length > 0 ? (
              filteredTxs.map((tx, i) => {
                const s = SIDE_STYLE[tx.side] ?? SIDE_STYLE['매수']
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-4 py-3.5"
                    style={i > 0 ? { borderTop: `1px solid ${T.divider}` } : {}}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ backgroundColor: s.bg, color: s.text }}
                      >
                        {tx.side}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] tabular-nums" style={{ color: T.textMuted }}>{tx.date}</p>
                        {tx.side !== '배당' && (
                          <p className="text-[11px] mt-0.5 tabular-nums" style={{ color: T.textMuted }}>
                            {fmtQty(tx.quantity)}주 × {fmtPrice(tx.price, tx.currency)}
                            {tx.currency !== 'KRW' && ` · ₩${Math.round(tx.fxRate).toLocaleString('ko-KR')}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className="shrink-0 ml-3 text-sm font-bold tabular-nums"
                      style={{ color: tx.side === '매도' ? T.red : tx.side === '배당' ? T.green : T.textPrimary }}
                    >
                      {tx.side === '매도' ? '−' : '+'}
                      {Math.round(tx.krwAmount).toLocaleString('ko-KR')}원
                    </span>
                  </div>
                )
              })
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: T.textMuted }}>해당 유형의 거래 없음</p>
              </div>
            )}
          </div>
        </div>

        {/* ⑤ 수동 가격 입력 */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: T.card, border: `1px solid ${T.inputBorder}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold" style={{ color: T.textMuted }}>현재가 수동 입력</p>
            {manualPrice != null && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ color: T.amber, backgroundColor: 'rgba(245,158,11,0.1)' }}
              >
                수동가 적용 · {fmtPrice(manualPrice, enriched.currency)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder={`현재가 입력 (${enriched.currency})`}
              className="flex-1 border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C] transition-colors"
              style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.textPrimary }}
            />
            <button
              onClick={handleSavePrice}
              disabled={!priceInput || parseFloat(priceInput) <= 0}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-40 active:opacity-80 transition-opacity"
              style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
            >
              저장
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
