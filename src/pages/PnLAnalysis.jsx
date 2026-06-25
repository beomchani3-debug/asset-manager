import { useState, useMemo } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useSettingsStore from '../store/useSettingsStore'
import usePriceStore from '../store/usePriceStore'
import { calcPnL } from '../utils/pnl'
import { T, MARKET_COLOR } from '../theme'

const MARKET_ORDER  = ['미국', '국내', '일본', '코인']

const fmtKrw = (n) => `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
const fmtSigned = (n) =>
  `${n >= 0 ? '+' : '−'}${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

function PnLValue({ value, percent = false, size = 'base' }) {
  const color   = value === 0 ? T.textMuted : value > 0 ? T.green : T.red
  const sizeCls = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl' }[size] ?? 'text-base'
  return (
    <span className={`font-bold tabular-nums ${sizeCls}`} style={{ color }}>
      {percent ? fmtPct(value) : fmtSigned(value)}
    </span>
  )
}

function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}
    >
      {children}
    </div>
  )
}

function Row({ label, value, bold = false }) {
  return (
    <div
      className={`flex items-center justify-between ${bold ? 'pt-2.5' : ''}`}
      style={bold ? { borderTop: `1px solid ${T.divider}` } : {}}
    >
      <span className={`text-xs ${bold ? 'font-semibold' : ''}`} style={{ color: bold ? T.textPrimary : T.textMuted }}>{label}</span>
      <PnLValue value={value} size="sm" />
    </div>
  )
}

// ─── 요약 탭 ─────────────────────────────────────────────────────────────────
function SummaryTab({ unrealized, realized, principal, marketValue, hasPriceWarning }) {
  const total      = unrealized + realized
  const returnRate = principal > 0 ? (total / principal) * 100 : 0

  return (
    <div className="space-y-4">
      {hasPriceWarning && (
        <div
          className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
          style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: `1px solid ${T.amber}`, color: T.amber }}
        >
          일부 종목은 현재가 조회 실패로 마지막 성공 가격 기준으로 계산됩니다.
        </div>
      )}

      <Card className="p-5">
        <p className="text-xs mb-1.5 text-center" style={{ color: T.textMuted }}>총 손익</p>
        <div className="text-center mb-1">
          <PnLValue value={total} size="xl" />
        </div>
        <div className="text-center mb-5">
          <PnLValue value={returnRate} percent size="sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ backgroundColor: T.inputBg }}>
            <p className="text-[10px] mb-1.5" style={{ color: T.textMuted }}>미실현손익</p>
            <PnLValue value={unrealized} size="sm" />
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: T.inputBg }}>
            <p className="text-[10px] mb-1.5" style={{ color: T.textMuted }}>실현손익</p>
            <PnLValue value={realized} size="sm" />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: T.textMuted }}>투자원금</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: T.textPrimary }}>{fmtKrw(principal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: T.textMuted }}>총 평가금액</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: T.goldLight }}>{fmtKrw(marketValue)}</span>
        </div>
        <div className="flex items-center justify-between pt-2.5" style={{ borderTop: `1px solid ${T.divider}` }}>
          <span className="text-xs font-semibold" style={{ color: T.textPrimary }}>수익률</span>
          <PnLValue value={returnRate} percent size="sm" />
        </div>
      </Card>
    </div>
  )
}

// ─── 시장별 탭 ────────────────────────────────────────────────────────────────
function MarketTab({ byMarketUnrealized, byMarketRealized, byMarketPrincipal }) {
  const markets = [...new Set([
    ...Object.keys(byMarketUnrealized),
    ...Object.keys(byMarketRealized),
  ])].sort((a, b) => (MARKET_ORDER.indexOf(a) ?? 99) - (MARKET_ORDER.indexOf(b) ?? 99))

  if (!markets.length) {
    return <p className="text-center text-sm py-12" style={{ color: T.textMuted }}>데이터가 없습니다</p>
  }

  return (
    <div className="space-y-3">
      {markets.map(market => {
        const unrealized = byMarketUnrealized[market] ?? 0
        const realized   = byMarketRealized[market]   ?? 0
        const principal  = byMarketPrincipal[market]  ?? 0
        const mv         = principal + unrealized
        const total      = unrealized + realized
        const returnRate = principal > 0 ? (total / principal) * 100 : 0
        const color      = MARKET_COLOR[market] ?? '#94A3B8'

        return (
          <Card key={market} className="p-4">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{market}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: '투자원금', value: fmtKrw(principal) },
                { label: '평가금액', value: fmtKrw(mv) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl px-2.5 py-2" style={{ backgroundColor: T.inputBg }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>{label}</p>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: T.textPrimary }}>{value}</p>
                </div>
              ))}
              <div className="rounded-xl px-2.5 py-2" style={{ backgroundColor: T.inputBg }}>
                <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>미실현손익</p>
                <PnLValue value={unrealized} size="sm" />
              </div>
              <div className="rounded-xl px-2.5 py-2" style={{ backgroundColor: T.inputBg }}>
                <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>실현손익</p>
                <PnLValue value={realized} size="sm" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2.5" style={{ borderTop: `1px solid ${T.divider}` }}>
              <span className="text-xs font-semibold" style={{ color: T.textPrimary }}>총손익</span>
              <div className="flex items-center gap-2">
                <PnLValue value={total} size="sm" />
                <PnLValue value={returnRate} percent size="sm" />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ─── 기간별 탭 ────────────────────────────────────────────────────────────────
function PeriodTab({ byMonth, byYear, totalRealized, totalUnrealized }) {
  const today    = new Date()
  const yr       = today.getFullYear()
  const mo       = String(today.getMonth() + 1).padStart(2, '0')
  const thisYM   = `${yr}-${mo}`
  const thisYear = String(yr)

  const thisMonthRealized = byMonth[thisYM]   ?? 0
  const thisYearRealized  = byYear[thisYear]  ?? 0

  const periods = [
    { label: '이번 달',  realized: thisMonthRealized, sub: `${yr}년 ${+mo}월 실현손익` },
    { label: '올해',     realized: thisYearRealized,  sub: `${yr}년 실현손익` },
    { label: '전체 누적', realized: totalRealized,     sub: '전체 실현손익 합계' },
  ]

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
        style={{ backgroundColor: 'rgba(91,155,213,0.1)', border: `1px solid ${T.blue}`, color: T.blue }}
      >
        미실현손익은 현재 시점 기준입니다. 기간별 미실현변화는 스냅샷 기능 추가 후 지원될 예정입니다.
      </div>

      {periods.map(({ label, realized, sub }) => (
        <Card key={label} className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-bold" style={{ color: T.textPrimary }}>{label}</p>
              <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>{sub}</p>
            </div>
          </div>
          <div className="space-y-2.5">
            <Row label="실현손익" value={realized} />
            <Row label="미실현손익 (현재 기준)" value={totalUnrealized} />
            <Row label="총손익" value={realized + totalUnrealized} bold />
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PnLAnalysis() {
  const [tab, setTab] = useState('요약')

  const transactions = useTransactionStore(s => s.transactions)
  const holdings     = useTransactionStore(s => s.holdings)
  const fxUSD        = useSettingsStore(s => s.settings.fxRates.USD)
  const fxJPY        = useSettingsStore(s => s.settings.fxRates.JPY)
  const prices       = usePriceStore(s => s.prices)

  const pnl = useMemo(() => calcPnL(transactions), [transactions])

  const portfolioStats = useMemo(() => {
    let totalPrincipal  = 0
    let totalMarketValue = 0
    let totalUnrealized  = 0
    let countNoPrice     = 0
    const byMarketUnrealized = {}
    const byMarketPrincipal  = {}

    for (const h of holdings) {
      const entry = prices[h.ticker]
      totalPrincipal += h.principal
      byMarketPrincipal[h.market] = (byMarketPrincipal[h.market] ?? 0) + h.principal

      if (entry) {
        let fx = 1
        if      (h.currency === 'USD') fx = fxUSD > 0 ? fxUSD : h.avgFxRate
        else if (h.currency === 'JPY') fx = fxJPY > 0 ? fxJPY : h.avgFxRate
        const mv     = h.quantity * entry.price * fx
        const unreal = mv - h.principal
        totalMarketValue += mv
        totalUnrealized  += unreal
        byMarketUnrealized[h.market] = (byMarketUnrealized[h.market] ?? 0) + unreal
      } else {
        countNoPrice++
        totalMarketValue += h.principal
      }
    }

    return {
      totalPrincipal,
      totalMarketValue,
      totalUnrealized,
      hasPriceWarning: countNoPrice > 0,
      byMarketUnrealized,
      byMarketPrincipal,
    }
  }, [holdings, prices, fxUSD, fxJPY])

  const TABS = ['요약', '시장별', '기간별']

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: T.bg }}>
      <div
        className="shrink-0 border-b px-4 pt-3 pb-3"
        style={{ backgroundColor: T.card, borderColor: T.gold }}
      >
        <div className="flex gap-1.5">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
              style={tab === t
                ? { backgroundColor: T.gold, color: '#0A0A0A' }
                : { backgroundColor: T.inputBg, color: T.textMuted }
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-6">
        {holdings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>📈</div>
            <p className="text-[15px] font-semibold" style={{ color: T.textPrimary }}>거래를 추가하면 손익이 분석됩니다</p>
          </div>
        ) : tab === '요약' ? (
          <SummaryTab
            unrealized={portfolioStats.totalUnrealized}
            realized={pnl.totalRealized}
            principal={portfolioStats.totalPrincipal}
            marketValue={portfolioStats.totalMarketValue}
            hasPriceWarning={portfolioStats.hasPriceWarning}
          />
        ) : tab === '시장별' ? (
          <MarketTab
            byMarketUnrealized={portfolioStats.byMarketUnrealized}
            byMarketRealized={pnl.byMarket}
            byMarketPrincipal={portfolioStats.byMarketPrincipal}
          />
        ) : (
          <PeriodTab
            byMonth={pnl.byMonth}
            byYear={pnl.byYear}
            totalRealized={pnl.totalRealized}
            totalUnrealized={portfolioStats.totalUnrealized}
          />
        )}
      </div>
    </div>
  )
}
