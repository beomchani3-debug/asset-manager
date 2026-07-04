import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts'
import useTransactionStore from '../store/useTransactionStore'
import useCashFlowStore from '../store/useCashFlowStore'
import useSettingsStore from '../store/useSettingsStore'
import usePriceStore from '../store/usePriceStore'
import usePortfolioSnapshotStore from '../store/usePortfolioSnapshotStore'
import { usePriceService } from '../hooks/usePriceService'
import { calcPnL } from '../utils/pnl'
import { T, MARKET_COLOR } from '../theme'

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmtKrw       = (n) => `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
const fmtKrwSigned = (n) => `${n >= 0 ? '+' : '-'}${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
const fmtPct       = (n, signed = true) => `${signed && n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const fmtYAxis     = (n) => {
  if (!n) return '0'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  const man = Math.round(n / 10000)
  return `${man.toLocaleString('ko-KR')}만`
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SIDE_STYLE = {
  '매수': { bg: '#0A1525', text: T.blue  },
  '매도': { bg: '#200A0A', text: T.red   },
  '배당': { bg: '#0D1A0D', text: T.green },
}

// ─── Shared tiny components ───────────────────────────────────────────────────
function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-2 px-0.5">
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>{title}</h2>
      {action}
    </div>
  )
}

function EmptyHint({ text }) {
  return <p className="py-7 text-center text-sm" style={{ color: T.textMuted }}>{text}</p>
}

function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}
    >
      {children}
    </div>
  )
}

// ─── Alloc donut tooltip ──────────────────────────────────────────────────────
function AllocTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { market, value, pct } = payload[0].payload
  return (
    <div className="rounded-xl px-3 py-2 text-[11px]" style={{ backgroundColor: '#0A0A0A', border: `1px solid ${T.gold}`, color: T.textPrimary }}>
      <p className="font-semibold">{market}</p>
      <p style={{ color: T.textMuted }}>₩{Math.round(value).toLocaleString('ko-KR')}</p>
      <p style={{ color: T.gold }}>{pct.toFixed(1)}%</p>
    </div>
  )
}

// ─── Asset chart tooltip ──────────────────────────────────────────────────────
function AssetChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-[11px]" style={{ backgroundColor: '#0A0A0A', border: `1px solid ${T.gold}`, color: T.textPrimary }}>
      <p style={{ color: T.textMuted }}>{label}</p>
      <p className="font-bold" style={{ color: T.goldLight }}>₩{Math.round(payload[0].value).toLocaleString('ko-KR')}</p>
    </div>
  )
}

// ─── FAB bottom sheet ─────────────────────────────────────────────────────────
function FabSheet({ onClose, navigate }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function close() { setVisible(false); setTimeout(onClose, 280) }

  const options = [
    { label: '거래 추가', icon: '📈', to: '/transactions', state: { autoOpen: true, defaultSide: '매수' } },
    { label: '배당 추가', icon: '💰', to: '/transactions', state: { autoOpen: true, defaultSide: '배당' } },
    { label: '가계부 추가', icon: '💳', to: '/budget', state: { autoOpen: true } },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={close}>
      <div className={`absolute inset-0 bg-black/60 transition-opacity duration-280 ${visible ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`relative w-full max-w-[430px] rounded-t-3xl pb-10 transition-transform duration-280 ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ backgroundColor: T.card, border: `1px solid ${T.gold}`, borderBottom: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: T.goldDim }} />
        </div>
        <p className="text-center text-[13px] font-bold mb-4" style={{ color: T.textMuted }}>빠른 입력</p>
        <div className="px-5 space-y-2.5">
          {options.map(({ label, icon, to, state }) => (
            <button
              key={label}
              onClick={() => { close(); setTimeout(() => navigate(to, { state }), 280) }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl active:opacity-80 transition-opacity text-left"
              style={{ backgroundColor: T.inputBg, border: `1px solid ${T.divider}` }}
            >
              <span className="text-xl">{icon}</span>
              <span className="text-[14px] font-semibold" style={{ color: T.textPrimary }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [fabOpen, setFabOpen] = useState(false)

  // ── Stores ───────────────────────────────────────────────────────────────
  const transactions      = useTransactionStore((s) => s.transactions)
  const holdings          = useTransactionStore((s) => s.holdings)
  const cashFlows         = useCashFlowStore((s) => s.cashFlows)
  const getMonthlySummary = useCashFlowStore((s) => s.getMonthlySummary)
  const dividendGoalKrw   = useSettingsStore((s) => s.settings.dividendGoalKrw)
  const fxUSD             = useSettingsStore((s) => s.settings.fxRates.USD)
  const fxJPY             = useSettingsStore((s) => s.settings.fxRates.JPY)
  const prices            = usePriceStore((s) => s.prices)
  const { snapshots, saveSnapshot } = usePortfolioSnapshotStore()
  const { refreshAll, isLoading, lastUpdatedAt } = usePriceService()

  // ── Date ─────────────────────────────────────────────────────────────────
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
      return { totalMarketValue: 0, totalPrincipal: 0, pnl: 0, pnlPct: 0, byMarket: {}, someNoPrice: false }
    }
    let totalMarketValue = 0, totalPrincipal = 0, countNoPrice = 0
    const byMarket = {}
    for (const h of holdings) {
      const entry = prices[h.ticker]
      let mv = h.principal
      if (entry) {
        let fx = 1
        if      (h.currency === 'USD') fx = fxUSD > 0 ? fxUSD : h.avgFxRate
        else if (h.currency === 'JPY') fx = fxJPY > 0 ? fxJPY : h.avgFxRate
        mv = h.quantity * entry.price * fx
      } else { countNoPrice++ }
      totalMarketValue += mv
      totalPrincipal   += h.principal
      byMarket[h.market] = (byMarket[h.market] ?? 0) + mv
    }
    const pnl    = totalMarketValue - totalPrincipal
    const pnlPct = totalPrincipal > 0 ? (pnl / totalPrincipal) * 100 : 0
    return { totalMarketValue, totalPrincipal, pnl, pnlPct, byMarket, someNoPrice: countNoPrice > 0 }
  }, [holdings, prices, fxUSD, fxJPY])

  // ── Save monthly snapshot when prices load ────────────────────────────────
  useEffect(() => {
    if (portfolio.totalMarketValue > 0 && !isLoading) {
      saveSnapshot(thisYM, portfolio.totalMarketValue)
    }
  }, [portfolio.totalMarketValue, isLoading, thisYM]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── PnL ──────────────────────────────────────────────────────────────────
  const pnlStats = useMemo(() => calcPnL(transactions), [transactions])
  const unrealizedPnl = portfolio.pnl
  const realizedPnl   = pnlStats.totalRealized
  const totalPnl      = unrealizedPnl + realizedPnl
  const totalReturn   = portfolio.totalPrincipal > 0 ? (totalPnl / portfolio.totalPrincipal) * 100 : 0

  // ── Cash flow ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flow    = useMemo(() => getMonthlySummary(thisYM), [cashFlows, thisYM])
  const netFlow = flow.income - flow.fixed - flow.variable

  // ── Dividend ──────────────────────────────────────────────────────────────
  const dividend = useMemo(() => {
    const divTx   = transactions.filter((t) => t.side === '배당')
    const monthly = divTx.filter((t) => t.date.startsWith(thisYM)).reduce((s, t) => s + t.krwAmount, 0)
    const annual  = divTx.filter((t) => t.date.startsWith(thisYear)).reduce((s, t) => s + t.krwAmount, 0)
    return { monthly, annual }
  }, [transactions, thisYM, thisYear])

  const goalPct = dividendGoalKrw > 0 ? Math.min(100, (dividend.monthly / dividendGoalKrw) * 100) : 0

  // ── Asset allocation ──────────────────────────────────────────────────────
  const allocation = useMemo(() => {
    const total = portfolio.totalMarketValue
    if (!total) return []
    return Object.entries(portfolio.byMarket)
      .map(([market, value]) => ({ market, value, pct: (value / total) * 100, color: MARKET_COLOR[market] ?? '#94A3B8' }))
      .sort((a, b) => b.value - a.value)
  }, [portfolio])

  // ── Chart data (last 6 monthly snapshots) ─────────────────────────────────
  const chartData = useMemo(() => {
    const entries = Object.entries(snapshots).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
    return entries.map(([ym, value]) => {
      const [, m] = ym.split('-')
      return { label: `${+m}월`, value }
    })
  }, [snapshots])

  const momChange = useMemo(() => {
    if (chartData.length < 2) return null
    const last = chartData[chartData.length - 1].value
    const prev = chartData[chartData.length - 2].value
    return prev > 0 ? ((last - prev) / prev) * 100 : null
  }, [chartData])

  // ── Recent transactions ───────────────────────────────────────────────────
  const recentTx = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    [transactions]
  )

  const isPnlPositive  = portfolio.pnl >= 0
  const lastUpdatedStr = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 pb-24" style={{ backgroundColor: T.bg }}>

      {/* ① 날짜 + 아이콘 */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-sm leading-snug" style={{ color: T.textMuted }}>{todayStr}</p>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {lastUpdatedStr && (
            <span className="text-[11px]" style={{ color: T.textMuted }}>{lastUpdatedStr} 기준</span>
          )}
          <button
            onClick={refreshAll}
            disabled={isLoading}
            aria-label="새로고침"
            className="w-8 h-8 rounded-full flex items-center justify-center active:opacity-70 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: T.card, border: `1px solid ${T.inputBorder}` }}
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: T.gold }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: T.textMuted }}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.65-3.65M20 15a9 9 0 01-14.65 3.65" />
              </svg>
            )}
          </button>
          <button
            onClick={() => navigate('/settings')}
            aria-label="설정"
            className="w-8 h-8 rounded-full flex items-center justify-center active:opacity-70 transition-opacity"
            style={{ backgroundColor: T.card, border: `1px solid ${T.inputBorder}` }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" style={{ color: T.textMuted }}>
              <circle cx="12" cy="12" r="3" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 총 평가금액 카드 */}
      <div
        className="rounded-2xl p-5 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1C1500 0%, #2D2000 55%, #1A1400 100%)', border: `1px solid ${T.gold}` }}
      >
        <p className="text-sm mb-1" style={{ color: T.goldDim }}>총 평가금액</p>
        {holdings.length > 0 ? (
          <>
            <p className="text-[2rem] font-bold tracking-tight leading-none" style={{ color: T.goldLight }}>
              {fmtKrw(portfolio.totalMarketValue)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: isPnlPositive ? T.green : T.red }}>
                {fmtKrwSigned(portfolio.pnl)}
              </span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: isPnlPositive ? 'rgba(76,175,80,0.2)' : 'rgba(224,82,82,0.2)',
                  color: isPnlPositive ? T.green : T.red,
                }}
              >
                {fmtPct(portfolio.pnlPct)}
              </span>
            </div>
            <p className="mt-1.5 text-xs" style={{ color: T.textMuted }}>
              투자원금 {fmtKrw(portfolio.totalPrincipal)}
            </p>
          </>
        ) : (
          <>
            <p className="text-[2rem] font-bold tracking-tight leading-none" style={{ color: T.goldDim }}>₩ —</p>
            <p className="mt-3 text-sm" style={{ color: T.textMuted }}>거래를 추가하면 자산이 집계됩니다</p>
          </>
        )}
      </div>

      {/* ② 자산 추이 그래프 */}
      {chartData.length > 1 && (
        <div
          className="rounded-2xl overflow-hidden p-4"
          style={{ backgroundColor: '#111111', border: `0.5px solid ${T.goldDim}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>자산 추이</p>
            {momChange !== null && (
              <span className="text-[12px] font-bold tabular-nums" style={{ color: momChange >= 0 ? T.green : T.red }}>
                {momChange >= 0 ? '+' : ''}{momChange.toFixed(1)}% 전월 대비
              </span>
            )}
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.gold} stopOpacity={0.10} />
                    <stop offset="95%" stopColor={T.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fill: T.textMuted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: T.textMuted, fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtYAxis}
                  width={40}
                />
                <Tooltip content={<AssetChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={T.gold}
                  strokeWidth={2}
                  fill="url(#goldGrad)"
                  dot={{ fill: T.gold, r: 3 }}
                  activeDot={{ fill: T.goldLight, r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ③ 손익 요약 카드 */}
      {holdings.length > 0 && (
        <Card className="p-4">
          {portfolio.someNoPrice && (
            <p
              className="text-[10px] rounded-lg px-2.5 py-1.5 mb-3 text-center"
              style={{ color: T.amber, backgroundColor: 'rgba(245,158,11,0.1)', border: `1px solid ${T.amber}` }}
            >
              일부 종목은 마지막 가격 기준으로 계산됩니다
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              { label: '미실현손익', value: unrealizedPnl },
              { label: '실현손익',   value: realizedPnl   },
              { label: '총 손익',    value: totalPnl,     bold: true },
              { label: '총 수익률',  value: totalReturn,  percent: true, bold: true },
            ].map(({ label, value, bold, percent }) => (
              <div key={label}>
                <p className="text-[10px] mb-0.5" style={{ color: T.textMuted }}>{label}</p>
                <p
                  className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'}`}
                  style={{ color: value === 0 ? T.textMuted : value > 0 ? T.green : T.red }}
                >
                  {percent ? fmtPct(value) : fmtKrwSigned(value)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ④ 배당 목표 진행률 */}
      {dividendGoalKrw > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold" style={{ color: T.textPrimary }}>
              월 배당 목표
            </p>
            <p className="text-[13px] font-bold tabular-nums" style={{ color: T.gold }}>
              ₩{dividendGoalKrw.toLocaleString('ko-KR')}
            </p>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: '#1C1C1C' }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${goalPct}%`, backgroundColor: T.gold }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: T.textMuted }}>
              이번달 ₩{dividend.monthly.toLocaleString('ko-KR')} 달성
            </span>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: goalPct >= 100 ? T.green : T.textPrimary }}>
              {goalPct.toFixed(1)}%
            </span>
          </div>
        </Card>
      )}

      {/* ⑥ 이번달 현금흐름 */}
      <section>
        <SectionHeader title={`${mo}월 현금흐름`} />
        <Card className="p-4">
          {cashFlows.length > 0 ? (
            <>
              <div className="grid grid-cols-3 mb-3" style={{ borderBottom: `1px solid ${T.divider}` }}>
                {[
                  { label: '수입',     value: flow.income,   color: T.green       },
                  { label: '고정비',   value: flow.fixed,    color: T.textPrimary },
                  { label: '변동지출', value: flow.variable, color: T.textPrimary },
                ].map(({ label, value, color }, i) => (
                  <div
                    key={label}
                    className="text-center px-2 first:pl-0 last:pr-0 pb-3"
                    style={i > 0 ? { borderLeft: `1px solid ${T.divider}` } : {}}
                  >
                    <p className="text-[11px] mb-1" style={{ color: T.textMuted }}>{label}</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color }}>{fmtKrw(value)}</p>
                  </div>
                ))}
              </div>
              <div
                className="rounded-xl px-4 py-2.5 flex items-center justify-between mt-3"
                style={{ backgroundColor: netFlow >= 0 ? 'rgba(76,175,80,0.08)' : 'rgba(224,82,82,0.08)', border: `1px solid ${netFlow >= 0 ? T.green : T.red}` }}
              >
                <span className="text-xs" style={{ color: T.textMuted }}>순현금흐름</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: netFlow >= 0 ? T.green : T.red }}>
                  {fmtKrwSigned(netFlow)}
                </span>
              </div>
            </>
          ) : (
            <EmptyHint text="가계부 내역을 추가해보세요" />
          )}
        </Card>
      </section>

      {/* ⑦ 배당 현황 */}
      <section>
        <SectionHeader title="배당 현황" />
        <Card className="p-4">
          {dividend.annual > 0 || dividend.monthly > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(76,175,80,0.08)', border: `1px solid ${T.green}` }}>
                <p className="text-[11px] mb-1" style={{ color: T.green }}>{mo}월 수령 배당</p>
                <p className="text-base font-bold tabular-nums" style={{ color: T.green }}>{fmtKrw(dividend.monthly)}</p>
              </div>
              <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(201,168,76,0.08)', border: `1px solid ${T.goldDim}` }}>
                <p className="text-[11px] mb-1" style={{ color: T.textMuted }}>연간 누적 ({thisYear})</p>
                <p className="text-base font-bold tabular-nums" style={{ color: T.goldLight }}>{fmtKrw(dividend.annual)}</p>
              </div>
            </div>
          ) : (
            <EmptyHint text="배당 거래를 추가해보세요" />
          )}
        </Card>
      </section>

      {/* ⑧ 자산 배분 */}
      <section>
        <SectionHeader title="자산 배분 (시장별)" />
        <Card className="p-4">
          {allocation.length > 0 ? (
            <div className="flex items-center gap-4">
              <div style={{ width: 150, height: 150, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocation}
                      innerRadius={46}
                      outerRadius={68}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {allocation.map((item, i) => (
                        <Cell key={i} fill={item.color} />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          const { cx, cy } = viewBox
                          return (
                            <g>
                              <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="middle" fill={T.goldLight} fontSize={12} fontWeight="bold" fontFamily="system-ui, sans-serif">
                                {fmtYAxis(portfolio.totalMarketValue)}
                              </text>
                              <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle" fill={T.textMuted} fontSize={10} fontFamily="system-ui, sans-serif">
                                총 자산
                              </text>
                            </g>
                          )
                        }}
                        position="center"
                      />
                    </Pie>
                    <Tooltip content={<AllocTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2.5">
                {allocation.map((item) => (
                  <div key={item.market}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[12px] font-semibold" style={{ color: T.textPrimary }}>{item.market}</span>
                      </div>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: T.textPrimary }}>{item.pct.toFixed(1)}%</span>
                    </div>
                    <p className="text-[10px] tabular-nums pl-3.5" style={{ color: T.textMuted }}>₩{Math.round(item.value).toLocaleString('ko-KR')}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyHint text="보유 종목을 추가해보세요" />
          )}
        </Card>
      </section>

      {/* ⑨ 최근 거래 */}
      <section>
        <SectionHeader
          title="최근 거래"
          action={
            <button onClick={() => navigate('/transactions')} className="text-xs font-medium active:opacity-70" style={{ color: T.gold }}>
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
                  className="flex items-center justify-between px-4 py-3.5"
                  style={i > 0 ? { borderTop: `1px solid ${T.divider}` } : {}}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: s.bg, color: s.text }}>
                      {tx.side}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: T.textPrimary }}>{tx.assetName}</p>
                      <p className="text-[11px]" style={{ color: T.textMuted }}>{tx.date}</p>
                    </div>
                  </div>
                  <span className="shrink-0 ml-3 text-sm font-semibold tabular-nums" style={{ color: tx.side === '매도' ? T.red : T.textPrimary }}>
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

      {/* FAB */}
      <button
        onClick={() => setFabOpen(true)}
        className="fixed right-5 bottom-24 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:opacity-80 transition-opacity z-40"
        style={{ backgroundColor: T.gold }}
        aria-label="빠른 입력"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {fabOpen && <FabSheet onClose={() => setFabOpen(false)} navigate={navigate} />}
    </div>
  )
}
