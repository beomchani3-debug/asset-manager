import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import useTransactionStore from '../store/useTransactionStore'
import useCashFlowStore from '../store/useCashFlowStore'
import { calcPnL } from '../utils/pnl'
import { T } from '../theme'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtKrw    = (n) => Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'
const fmtSigned = (n) => (n >= 0 ? '+' : '−') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'
const fmtPct    = (n) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'

function currentYM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function ymLabel(ym) {
  const [y, m] = ym.split('-')
  return `${y}년 ${+m}월`
}
function momPct(curr, prev) {
  if (!prev || prev === 0) return null
  return ((curr - prev) / prev) * 100
}

const CAT_COLORS = [
  '#C9A84C', '#5B9BD5', '#4CAF50', '#E05252', '#F59E0B',
  '#9B59B6', '#1ABC9C', '#E67E22', '#3498DB', '#E91E63',
  '#00BCD4', '#FF5722',
]

// ─── Shared components ────────────────────────────────────────────────────────
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

function SectionTitle({ title }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-0.5" style={{ color: T.textMuted }}>
      {title}
    </h2>
  )
}

function NavBtn({ onClick, dir }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 flex items-center justify-center rounded-xl active:opacity-70"
      style={{ backgroundColor: T.inputBg }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        {dir === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="px-2.5 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: T.card, border: `1px solid ${T.gold}`, color: T.textPrimary }}>
      {name}: {fmtKrw(value)}
    </div>
  )
}

// ─── MonthlyReport ────────────────────────────────────────────────────────────
export default function MonthlyReport() {
  const [ym, setYm]  = useState(currentYM())
  const prevYm       = shiftMonth(ym, -1)

  const transactions = useTransactionStore((s) => s.transactions)
  const cashFlows    = useCashFlowStore((s) => s.cashFlows)

  // CashFlow stats — 스토어 메서드 대신 직접 계산 (stale closure 방지)
  const summary = useMemo(() => {
    const flows = cashFlows.filter((c) => c.date.startsWith(ym))
    return {
      income:   flows.filter((c) => c.type === '수입').reduce((s, c) => s + c.amount, 0),
      fixed:    flows.filter((c) => c.type === '고정비').reduce((s, c) => s + c.amount, 0),
      variable: flows.filter((c) => c.type === '변동지출' || c.type === '용돈지출').reduce((s, c) => s + c.amount, 0),
    }
  }, [cashFlows, ym])

  const prevSummary = useMemo(() => {
    const flows = cashFlows.filter((c) => c.date.startsWith(prevYm))
    return {
      income:   flows.filter((c) => c.type === '수입').reduce((s, c) => s + c.amount, 0),
      fixed:    flows.filter((c) => c.type === '고정비').reduce((s, c) => s + c.amount, 0),
      variable: flows.filter((c) => c.type === '변동지출' || c.type === '용돈지출').reduce((s, c) => s + c.amount, 0),
    }
  }, [cashFlows, prevYm])

  const expense     = summary.fixed + summary.variable
  const prevExpense = prevSummary.fixed + prevSummary.variable
  const balance     = summary.income - expense

  const breakdown = useMemo(() => {
    const flows = cashFlows.filter((c) => c.date.startsWith(ym) && c.type !== '수입')
    return flows.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + c.amount
      return acc
    }, {})
  }, [cashFlows, ym])

  const catEntries = Object.entries(breakdown).sort((a, b) => b[1] - a[1])
  const pieData    = catEntries.map(([name, value]) => ({ name, value }))

  // Transaction stats
  const mTx     = useMemo(() => transactions.filter((tx) => tx.date.startsWith(ym)),    [transactions, ym])
  const prevMTx = useMemo(() => transactions.filter((tx) => tx.date.startsWith(prevYm)), [transactions, prevYm])

  const divTxs       = mTx.filter((tx) => tx.side === '배당')
  const prevDivTxs   = prevMTx.filter((tx) => tx.side === '배당')
  const divTotal     = divTxs.reduce((s, tx) => s + tx.krwAmount, 0)
  const prevDivTotal = prevDivTxs.reduce((s, tx) => s + tx.krwAmount, 0)

  const divByTicker = useMemo(() => {
    const map = {}
    for (const tx of divTxs) {
      if (!map[tx.ticker]) map[tx.ticker] = { assetName: tx.assetName, total: 0, count: 0 }
      map[tx.ticker].total += tx.krwAmount
      map[tx.ticker].count++
    }
    return map
  }, [divTxs])

  const buyTxs    = mTx.filter((tx) => tx.side === '매수')
  const sellTxs   = mTx.filter((tx) => tx.side === '매도')
  const investment = buyTxs.reduce((s, tx) => s + tx.krwAmount, 0)

  // Realized PnL
  const allPnl            = useMemo(() => calcPnL(transactions), [transactions])
  const realizedThisMonth = useMemo(() => allPnl.realizedList.filter((r) => r.date.startsWith(ym)), [allPnl, ym])
  const realizedPnl       = allPnl.byMonth[ym] ?? 0

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: T.bg }}>

      {/* Month navigator */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b" style={{ borderColor: T.divider }}>
        <NavBtn onClick={() => setYm(shiftMonth(ym, -1))} dir="left" />
        <span className="text-[16px] font-bold" style={{ color: T.gold }}>{ymLabel(ym)}</span>
        <NavBtn onClick={() => setYm(shiftMonth(ym, 1))} dir="right" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-8">

        {/* ── Summary ──────────────────────────────────────────────── */}
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '수입',    value: summary.income, color: T.green },
              { label: '지출',    value: expense,        color: T.red   },
              { label: '투자납입', value: investment,     color: T.blue  },
              { label: '잔액',    value: balance,        color: balance >= 0 ? T.gold : T.red },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3" style={{ backgroundColor: T.inputBg }}>
                <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>{label}</p>
                <p className="text-[15px] font-bold tabular-nums leading-tight" style={{ color }}>
                  {fmtKrw(value)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Category breakdown ────────────────────────────────────── */}
        {catEntries.length > 0 && (
          <div>
            <SectionTitle title="지출 카테고리" />
            <Card className="p-4">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={78}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-1">
                {catEntries.map(([cat, amt], i) => {
                  const pct = expense > 0 ? (amt / expense) * 100 : 0
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                      <span className="text-[12px] flex-1 truncate" style={{ color: T.textPrimary }}>{cat}</span>
                      <span className="text-[11px] tabular-nums shrink-0" style={{ color: T.textMuted }}>{pct.toFixed(1)}%</span>
                      <span className="text-[12px] font-semibold tabular-nums shrink-0 ml-1" style={{ color: T.textPrimary }}>{fmtKrw(amt)}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ── Dividends ────────────────────────────────────────────── */}
        <div>
          <SectionTitle title="배당금" />
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold" style={{ color: T.textPrimary }}>총 배당금</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold tabular-nums" style={{ color: T.green }}>{fmtKrw(divTotal)}</span>
                {(() => {
                  const pct = momPct(divTotal, prevDivTotal)
                  if (pct === null) return null
                  return (
                    <span className="text-[11px] font-semibold" style={{ color: pct >= 0 ? T.green : T.red }}>
                      {fmtPct(pct)}
                    </span>
                  )
                })()}
              </div>
            </div>
            {Object.keys(divByTicker).length === 0 ? (
              <p className="text-[12px] text-center py-2" style={{ color: T.textMuted }}>이번달 배당 내역 없음</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(divByTicker).map(([ticker, { assetName, total, count }]) => (
                  <div key={ticker} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-[12px] font-semibold truncate block" style={{ color: T.textPrimary }}>
                        {assetName || ticker}
                      </span>
                      {count > 1 && <span className="text-[10px]" style={{ color: T.textMuted }}>{count}건</span>}
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: T.green }}>{fmtKrw(total)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Trade activity ────────────────────────────────────────── */}
        <div>
          <SectionTitle title="거래 현황" />
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl py-3" style={{ backgroundColor: T.inputBg }}>
                <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>매수</p>
                <p className="text-[20px] font-bold leading-tight" style={{ color: T.blue }}>{buyTxs.length}</p>
                <p className="text-[10px]" style={{ color: T.textMuted }}>건</p>
              </div>
              <div className="rounded-xl py-3" style={{ backgroundColor: T.inputBg }}>
                <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>매도</p>
                <p className="text-[20px] font-bold leading-tight" style={{ color: T.red }}>{sellTxs.length}</p>
                <p className="text-[10px]" style={{ color: T.textMuted }}>건</p>
              </div>
              <div className="rounded-xl py-3" style={{ backgroundColor: T.inputBg }}>
                <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>투자금액</p>
                <p className="text-[12px] font-bold tabular-nums leading-tight" style={{ color: T.gold }}>{fmtKrw(investment)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Realized PnL ─────────────────────────────────────────── */}
        <div>
          <SectionTitle title="실현 손익" />
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold" style={{ color: T.textPrimary }}>합계</span>
              <span
                className="text-[15px] font-bold tabular-nums"
                style={{ color: realizedPnl === 0 ? T.textMuted : realizedPnl > 0 ? T.green : T.red }}
              >
                {realizedPnl === 0 ? '−' : fmtSigned(realizedPnl)}
              </span>
            </div>
            {realizedThisMonth.length === 0 ? (
              <p className="text-[12px] text-center py-1" style={{ color: T.textMuted }}>이번달 매도 내역 없음</p>
            ) : (
              <div className="space-y-2">
                {realizedThisMonth.map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-[12px] font-semibold truncate block" style={{ color: T.textPrimary }}>
                        {r.assetName || r.ticker}
                      </span>
                      <span className="text-[10px]" style={{ color: T.textMuted }}>{r.date} · {r.qty}주</span>
                    </div>
                    <span
                      className="text-[12px] font-semibold tabular-nums shrink-0"
                      style={{ color: r.pnl === 0 ? T.textMuted : r.pnl > 0 ? T.green : T.red }}
                    >
                      {fmtSigned(r.pnl)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── MoM comparison ───────────────────────────────────────── */}
        <div>
          <SectionTitle title={`지난달 (${ymLabel(prevYm)}) 대비`} />
          <Card className="p-4 space-y-2.5">
            {[
              { label: '수입',   curr: summary.income, prev: prevSummary.income, higherGood: true },
              { label: '지출',   curr: expense,        prev: prevExpense,        higherGood: false },
              { label: '배당금', curr: divTotal,        prev: prevDivTotal,       higherGood: true },
            ].map(({ label, curr, prev, higherGood }) => {
              const pct = momPct(curr, prev)
              const pctColor = pct == null || pct === 0
                ? T.textMuted
                : (pct > 0) === higherGood ? T.green : T.red
              return (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[12px]" style={{ color: T.textMuted }}>{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] tabular-nums" style={{ color: T.textPrimary }}>{fmtKrw(curr)}</span>
                    {pct != null && (
                      <span className="text-[11px] font-semibold" style={{ color: pctColor }}>
                        {fmtPct(pct)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </Card>
        </div>

      </div>
    </div>
  )
}
