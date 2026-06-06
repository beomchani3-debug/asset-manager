import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useTransactionStore from '../store/useTransactionStore'
import useCashFlowStore from '../store/useCashFlowStore'
import useSettingsStore from '../store/useSettingsStore'
import usePriceStore from '../store/usePriceStore'
import { usePriceService } from '../hooks/usePriceService'

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmtKrw = (n) => `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
const fmtKrwSigned = (n) => `${n >= 0 ? '+' : '-'}${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
const fmtPct = (n, signed = true) => `${signed && n >= 0 ? '+' : ''}${n.toFixed(2)}%`

// ─── Constants ────────────────────────────────────────────────────────────────
const MARKET_COLOR = { '미국': '#2563EB', '국내': '#16A34A', '일본': '#DC2626', '코인': '#CA8A04' }

const SIDE_STYLE = {
  '매수': { bg: 'bg-blue-50',    text: 'text-blue-600'    },
  '매도': { bg: 'bg-red-50',     text: 'text-red-500'     },
  '배당': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
}

// ─── Tiny shared components ───────────────────────────────────────────────────
function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-2 px-0.5">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h2>
      {action}
    </div>
  )
}

function EmptyHint({ text }) {
  return <p className="py-7 text-center text-sm text-slate-400">{text}</p>
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-white shadow-sm border border-slate-100 ${className}`}>
      {children}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()

  // ── Store subscriptions ───────────────────────────────────────────────────
  const transactions    = useTransactionStore((s) => s.transactions)
  const holdings        = useTransactionStore((s) => s.holdings)
  const cashFlows       = useCashFlowStore((s) => s.cashFlows)
  const getMonthlySummary = useCashFlowStore((s) => s.getMonthlySummary)
  const dividendGoalKrw = useSettingsStore((s) => s.settings.dividendGoalKrw)
  const fxUSD           = useSettingsStore((s) => s.settings.fxRates.USD)
  const fxJPY           = useSettingsStore((s) => s.settings.fxRates.JPY)
  const prices          = usePriceStore((s) => s.prices)
  const { refreshAll, isLoading, lastUpdatedAt } = usePriceService()

  // ── Date constants (local time) ───────────────────────────────────────────
  const today    = new Date()
  const yr       = today.getFullYear()
  const mo       = String(today.getMonth() + 1).padStart(2, '0')
  const thisYM   = `${yr}-${mo}`
  const thisYear = String(yr)
  const todayStr = today.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  // ── Portfolio stats ───────────────────────────────────────────────────────
  const portfolio = useMemo(() => {
    if (!holdings.length) {
      return { totalMarketValue: 0, totalPrincipal: 0, pnl: 0, pnlPct: 0, byMarket: {} }
    }

    let totalMarketValue = 0
    let totalPrincipal   = 0
    const byMarket = {}

    for (const h of holdings) {
      const entry = prices[h.ticker]
      let mv = h.principal // 현재가 없으면 원금으로 대체

      if (entry) {
        let fx = 1
        if      (h.currency === 'USD') fx = fxUSD > 0 ? fxUSD : h.avgFxRate
        else if (h.currency === 'JPY') fx = fxJPY > 0 ? fxJPY : h.avgFxRate
        mv = h.quantity * entry.price * fx
      }

      totalMarketValue += mv
      totalPrincipal   += h.principal
      byMarket[h.market] = (byMarket[h.market] ?? 0) + mv
    }

    const pnl    = totalMarketValue - totalPrincipal
    const pnlPct = totalPrincipal > 0 ? (pnl / totalPrincipal) * 100 : 0
    return { totalMarketValue, totalPrincipal, pnl, pnlPct, byMarket }
  }, [holdings, prices, fxUSD, fxJPY])

  // ── Monthly cash flow ─────────────────────────────────────────────────────
  // cashFlows in deps triggers re-compute when data changes (getMonthlySummary is stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flow    = useMemo(() => getMonthlySummary(thisYM), [cashFlows, thisYM])
  const netFlow = flow.income - flow.fixed - flow.variable

  // ── Dividend stats ────────────────────────────────────────────────────────
  const dividend = useMemo(() => {
    const divTx  = transactions.filter((t) => t.side === '배당')
    const monthly = divTx.filter((t) => t.date.startsWith(thisYM)).reduce((s, t) => s + t.krwAmount, 0)
    const annual  = divTx.filter((t) => t.date.startsWith(thisYear)).reduce((s, t) => s + t.krwAmount, 0)
    return { monthly, annual }
  }, [transactions, thisYM, thisYear])

  const goalPct = dividendGoalKrw > 0
    ? Math.min(100, (dividend.monthly / dividendGoalKrw) * 100)
    : 0

  // ── Asset allocation by market ────────────────────────────────────────────
  const allocation = useMemo(() => {
    const total = portfolio.totalMarketValue
    if (!total) return []
    return Object.entries(portfolio.byMarket)
      .map(([market, value]) => ({
        market,
        value,
        pct: (value / total) * 100,
        color: MARKET_COLOR[market] ?? '#94A3B8',
      }))
      .sort((a, b) => b.value - a.value)
  }, [portfolio])

  // ── Recent 5 transactions ─────────────────────────────────────────────────
  const recentTx = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    [transactions]
  )

  const isPnlPositive = portfolio.pnl >= 0
  const lastUpdatedStr = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 pb-6">

      {/* ① 날짜 + 새로고침 */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-sm text-slate-500 leading-snug">{todayStr}</p>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {lastUpdatedStr && (
            <span className="text-[11px] text-slate-400">{lastUpdatedStr} 기준</span>
          )}
          <button
            onClick={refreshAll}
            disabled={isLoading}
            aria-label="새로고침"
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm active:opacity-70 disabled:opacity-50 transition-opacity"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.65-3.65M20 15a9 9 0 01-14.65 3.65" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ② 총 자산 카드 */}
      <div
        className="rounded-2xl p-5 shadow-lg shadow-blue-100 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)' }}
      >
        <p className="text-sm text-blue-200 mb-1">총 평가금액</p>
        {holdings.length > 0 ? (
          <>
            <p className="text-[2rem] font-bold text-white tracking-tight leading-none">
              {fmtKrw(portfolio.totalMarketValue)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`text-sm font-semibold ${isPnlPositive ? 'text-white' : 'text-red-300'}`}>
                {fmtKrwSigned(portfolio.pnl)}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isPnlPositive ? 'bg-white/20 text-blue-100' : 'bg-red-400/30 text-red-200'
              }`}>
                {fmtPct(portfolio.pnlPct)}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-blue-300">
              투자원금 {fmtKrw(portfolio.totalPrincipal)}
            </p>
          </>
        ) : (
          <>
            <p className="text-[2rem] font-bold text-white/30 tracking-tight leading-none">₩ —</p>
            <p className="mt-3 text-sm text-blue-300">거래를 추가하면 자산이 집계됩니다</p>
          </>
        )}
      </div>

      {/* ③ 이번달 현금흐름 */}
      <section>
        <SectionHeader title={`${mo}월 현금흐름`} />
        <Card className="p-4">
          {cashFlows.length > 0 ? (
            <>
              <div className="grid grid-cols-3 divide-x divide-slate-100 mb-3">
                {[
                  { label: '수입',    value: flow.income,   color: 'text-blue-600'  },
                  { label: '고정비',  value: flow.fixed,    color: 'text-slate-700' },
                  { label: '변동지출', value: flow.variable, color: 'text-slate-700' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center px-2 first:pl-0 last:pr-0">
                    <p className="text-[11px] text-slate-400 mb-1">{label}</p>
                    <p className={`text-sm font-bold ${color} tabular-nums`}>{fmtKrw(value)}</p>
                  </div>
                ))}
              </div>
              <div className={`rounded-xl px-4 py-2.5 flex items-center justify-between ${
                netFlow >= 0 ? 'bg-blue-50' : 'bg-red-50'
              }`}>
                <span className="text-xs text-slate-500">순현금흐름</span>
                <span className={`text-sm font-bold tabular-nums ${netFlow >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  {fmtKrwSigned(netFlow)}
                </span>
              </div>
            </>
          ) : (
            <EmptyHint text="가계부 내역을 추가해보세요" />
          )}
        </Card>
      </section>

      {/* ④ 배당 현황 */}
      <section>
        <SectionHeader title="배당 현황" />
        <Card className="p-4">
          {dividend.annual > 0 || dividend.monthly > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-[11px] text-emerald-500 mb-1">{mo}월 수령 배당</p>
                  <p className="text-base font-bold text-emerald-700 tabular-nums">{fmtKrw(dividend.monthly)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-400 mb-1">연간 누적 ({thisYear})</p>
                  <p className="text-base font-bold text-slate-800 tabular-nums">{fmtKrw(dividend.annual)}</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">이번달 목표 달성률</span>
                  <span className="text-xs font-semibold text-slate-600 tabular-nums">
                    {goalPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-right text-[11px] text-slate-400">
                  목표 {fmtKrw(dividendGoalKrw)}
                </p>
              </div>
            </>
          ) : (
            <EmptyHint text="배당 거래를 추가해보세요" />
          )}
        </Card>
      </section>

      {/* ⑤ 자산 배분 */}
      <section>
        <SectionHeader title="자산 배분 (시장별)" />
        <Card className="p-4">
          {allocation.length > 0 ? (
            <>
              {/* 가로 비율 바 */}
              <div className="flex rounded-full overflow-hidden h-3 mb-4 gap-px">
                {allocation.map((item) => (
                  <div
                    key={item.market}
                    title={`${item.market} ${item.pct.toFixed(1)}%`}
                    style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                  />
                ))}
              </div>
              {/* 범례 */}
              <div className="space-y-2.5">
                {allocation.map((item) => (
                  <div key={item.market} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-slate-700">{item.market}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 tabular-nums">{fmtKrw(item.value)}</span>
                      <span className="text-xs font-semibold text-slate-600 tabular-nums w-11 text-right">
                        {item.pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyHint text="보유 종목을 추가해보세요" />
          )}
        </Card>
      </section>

      {/* ⑥ 최근 거래 5건 */}
      <section>
        <SectionHeader
          title="최근 거래"
          action={
            <button
              onClick={() => navigate('/transactions')}
              className="text-xs text-blue-600 font-medium active:opacity-70"
            >
              전체보기 ›
            </button>
          }
        />
        <Card className="overflow-hidden">
          {recentTx.length > 0 ? (
            recentTx.map((tx, i) => {
              const s = SIDE_STYLE[tx.side] ?? SIDE_STYLE['매수']
              return (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between px-4 py-3.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
                      {tx.side}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{tx.assetName}</p>
                      <p className="text-[11px] text-slate-400">{tx.date}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 ml-3 text-sm font-semibold tabular-nums ${
                    tx.side === '매도' ? 'text-red-500' : 'text-slate-800'
                  }`}>
                    {fmtKrw(tx.krwAmount)}
                  </span>
                </div>
              )
            })
          ) : (
            <EmptyHint text="거래를 추가해보세요" />
          )}
        </Card>
      </section>

    </div>
  )
}
