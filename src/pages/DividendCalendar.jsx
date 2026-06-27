import { useState, useMemo, useRef } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useDividendScheduleStore from '../store/useDividendScheduleStore'
import useToastStore from '../store/useToastStore'
import { T } from '../theme'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtKrw = (n) => Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'

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

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const PERIODS  = ['월배당', '분기배당', '반기배당', '연배당']
const PERIOD_PRESET = {
  '월배당':   [1,2,3,4,5,6,7,8,9,10,11,12],
  '분기배당': [3,6,9,12],
  '반기배당': [6,12],
  '연배당':   [12],
}

function buildCalendarCells(year, month) {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const lastDate = new Date(year, month, 0).getDate()
  const cells = Array(firstDow).fill(null)
  for (let d = 1; d <= lastDate; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function detectDivSchedule(txs) {
  if (!txs.length) return null
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date))
  const months  = [...new Set(sorted.map((tx) => Number(tx.date.slice(5, 7))))].sort((a, b) => a - b)
  const days    = sorted.map((tx) => Number(tx.date.slice(8, 10)))
  const avgDay  = Math.round(days.reduce((s, d) => s + d, 0) / days.length)
  const avgKrw  = sorted.reduce((s, tx) => s + tx.krwAmount, 0) / sorted.length

  let period = 'unknown'
  if (months.length >= 10)                      period = '월배당'
  else if (months.length >= 3 && months.length <= 5) period = '분기배당'
  else if (months.length === 2)                 period = '반기배당'
  else if (months.length === 1)                 period = '연배당'

  return { day: avgDay, months, period, avgKrw }
}

function getExpectedForMonth(month, transactions, userSchedules) {
  const groups = {}
  for (const tx of transactions.filter((tx) => tx.side === '배당')) {
    if (!groups[tx.ticker]) groups[tx.ticker] = { assetName: tx.assetName, txs: [] }
    groups[tx.ticker].txs.push(tx)
  }

  const result = []
  const seen = new Set()

  // User overrides first
  for (const [ticker, sched] of Object.entries(userSchedules)) {
    if (sched.months.includes(month)) {
      result.push({ ticker, assetName: sched.assetName || ticker, day: sched.day, avgKrw: sched.amountKrw || 0, source: 'manual' })
      seen.add(ticker)
    }
  }

  // Auto-detect for remaining tickers
  for (const [ticker, { assetName, txs }] of Object.entries(groups)) {
    if (seen.has(ticker)) continue
    const sched = detectDivSchedule(txs)
    if (!sched || !sched.months.includes(month)) continue
    result.push({ ticker, assetName: assetName || ticker, day: sched.day, avgKrw: sched.avgKrw, source: 'auto' })
  }

  return result
}

// ─── DividendCalendar ─────────────────────────────────────────────────────────
export default function DividendCalendar() {
  const [ym, setYm]             = useState(currentYM())
  const [selectedDay, setSelectedDay] = useState(null)
  const [showManager, setShowManager] = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [editTicker, setEditTicker]   = useState(null)

  const EMPTY_FORM = { ticker: '', assetName: '', period: '월배당', months: PERIOD_PRESET['월배당'], day: '', amountKrw: '' }
  const [form, setForm] = useState(EMPTY_FORM)

  const transactions               = useTransactionStore((s) => s.transactions)
  const { schedules, setSchedule, removeSchedule } = useDividendScheduleStore()
  const push = useToastStore((s) => s.push)

  const touchStartX = useRef(0)
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx >  60) setYm(shiftMonth(ym, -1))
    if (dx < -60) setYm(shiftMonth(ym,  1))
    setSelectedDay(null)
  }

  const [year, month] = ym.split('-').map(Number)
  const cells    = useMemo(() => buildCalendarCells(year, month), [year, month])
  const expected = useMemo(() => getExpectedForMonth(month, transactions, schedules), [month, transactions, schedules])

  const byDay = useMemo(() => {
    const map = {}
    for (const item of expected) {
      if (!map[item.day]) map[item.day] = []
      map[item.day].push(item)
    }
    return map
  }, [expected])

  const monthTotal = expected.reduce((s, e) => s + (e.avgKrw || 0), 0)

  const historyTickers = useMemo(() => {
    const g = {}
    for (const tx of transactions.filter((tx) => tx.side === '배당')) {
      if (!g[tx.ticker]) g[tx.ticker] = { assetName: tx.assetName, txs: [] }
      g[tx.ticker].txs.push(tx)
    }
    return Object.entries(g).map(([ticker, { assetName, txs }]) => ({
      ticker, assetName: assetName || ticker, autoSched: detectDivSchedule(txs),
    }))
  }, [transactions])

  const today = new Date()
  const isToday = (d) => d === today.getDate() && year === today.getFullYear() && month === today.getMonth() + 1

  // ─── Schedule form helpers ────────────────────────────────────────────────
  function openAdd() {
    setEditTicker(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(ticker) {
    setEditTicker(ticker)
    const s = schedules[ticker]
    if (s) {
      setForm({ ticker, assetName: s.assetName || ticker, period: s.period || '월배당', months: s.months, day: String(s.day), amountKrw: String(s.amountKrw || '') })
    } else {
      const hist = historyTickers.find((h) => h.ticker === ticker)
      const auto = hist?.autoSched
      setForm({
        ticker,
        assetName: hist?.assetName || ticker,
        period: auto?.period || '월배당',
        months: auto?.months || PERIOD_PRESET['월배당'],
        day: String(auto?.day || ''),
        amountKrw: String(Math.round(auto?.avgKrw || '')),
      })
    }
    setShowForm(true)
  }

  function handlePeriodChange(period) {
    setForm((f) => ({ ...f, period, months: PERIOD_PRESET[period] || [] }))
  }

  function toggleMonth(m) {
    setForm((f) => ({
      ...f,
      months: f.months.includes(m)
        ? f.months.filter((x) => x !== m)
        : [...f.months, m].sort((a, b) => a - b),
    }))
  }

  function saveSched() {
    const ticker    = form.ticker.trim().toUpperCase()
    const day       = parseInt(form.day, 10)
    const amountKrw = parseInt(String(form.amountKrw).replace(/,/g, ''), 10) || 0
    if (!ticker)                       { push('종목코드를 입력하세요', 'error'); return }
    if (!day || day < 1 || day > 31)  { push('날짜는 1~31', 'error'); return }
    if (!form.months.length)           { push('지급 월을 선택하세요', 'error'); return }
    setSchedule(ticker, { assetName: form.assetName || ticker, period: form.period, months: form.months, day, amountKrw })
    setShowForm(false)
    push(`${ticker} 배당 일정 저장`, 'success')
  }

  const inpStyle = { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.textPrimary }
  const manualOnlyTickers = Object.keys(schedules).filter((t) => !historyTickers.find((h) => h.ticker === t))

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: T.bg }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b" style={{ borderColor: T.divider }}>
        <button
          onClick={() => { setYm(shiftMonth(ym, -1)); setSelectedDay(null) }}
          className="w-9 h-9 flex items-center justify-center rounded-xl active:opacity-70"
          style={{ backgroundColor: T.inputBg }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-[16px] font-bold" style={{ color: T.gold }}>{ymLabel(ym)}</p>
          {monthTotal > 0 && (
            <p className="text-[11px] mt-0.5" style={{ color: T.green }}>예상 배당 {fmtKrw(monthTotal)}</p>
          )}
        </div>
        <button
          onClick={() => { setYm(shiftMonth(ym, 1)); setSelectedDay(null) }}
          className="w-9 h-9 flex items-center justify-center rounded-xl active:opacity-70"
          style={{ backgroundColor: T.inputBg }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Calendar */}
        <div
          className="px-3 pt-3 pb-2 select-none"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className="text-center text-[11px] font-semibold py-1"
                style={{ color: i === 0 ? T.red : i === 6 ? T.blue : T.textMuted }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} className="aspect-square" />
              const hasDividend = !!byDay[day]
              const isSelected  = selectedDay === day
              const dow         = idx % 7
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className="flex flex-col items-center justify-start pt-1.5 pb-1 rounded-xl relative transition-colors"
                  style={{
                    backgroundColor: isSelected ? 'rgba(201,168,76,0.15)' : hasDividend ? 'rgba(201,168,76,0.05)' : 'transparent',
                    border: isSelected ? `1px solid ${T.gold}` : '1px solid transparent',
                    minHeight: 46,
                  }}
                >
                  <span
                    className="text-[13px] leading-none"
                    style={{
                      color: isToday(day) ? T.gold : dow === 0 ? T.red : dow === 6 ? T.blue : T.textPrimary,
                      fontWeight: isToday(day) ? 800 : 500,
                    }}
                  >
                    {day}
                  </span>
                  {hasDividend && (
                    <div className="flex gap-0.5 mt-1.5 flex-wrap justify-center">
                      {byDay[day].slice(0, 3).map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.gold }} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day panel */}
        {selectedDay !== null && (
          <div className="mx-3 mb-3 rounded-2xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>
            <p className="text-[12px] font-bold mb-2.5" style={{ color: T.gold }}>
              {month}월 {selectedDay}일 배당
            </p>
            {(byDay[selectedDay] || []).length === 0 ? (
              <p className="text-[12px]" style={{ color: T.textMuted }}>배당 예정 없음</p>
            ) : (
              <div className="space-y-2">
                {(byDay[selectedDay] || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-[13px] font-semibold" style={{ color: T.textPrimary }}>{item.assetName}</span>
                      <span className="text-[10px] ml-1.5" style={{ color: T.textMuted }}>{item.ticker}</span>
                      {item.source === 'auto' && (
                        <span className="text-[9px] ml-1 px-1 rounded" style={{ color: T.goldDim, backgroundColor: 'rgba(201,168,76,0.08)' }}>
                          추정
                        </span>
                      )}
                    </div>
                    {item.avgKrw > 0 && (
                      <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: T.green }}>
                        ~{fmtKrw(item.avgKrw)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Schedule manager toggle */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowManager(!showManager)}
            className="w-full py-2.5 text-[12px] font-semibold rounded-xl transition-colors"
            style={{ backgroundColor: T.inputBg, color: T.textMuted }}
          >
            {showManager ? '▲ 배당 일정 닫기' : '⚙ 배당 일정 관리'}
          </button>
        </div>

        {/* Schedule manager body */}
        {showManager && (
          <div className="px-3 pb-8 space-y-4">

            {/* Auto-detected from history */}
            {historyTickers.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold mb-2 px-0.5 uppercase tracking-wider" style={{ color: T.textMuted }}>
                  거래기록 자동 감지
                </p>
                <div className="space-y-2">
                  {historyTickers.map(({ ticker, assetName, autoSched }) => {
                    const hasOverride = !!schedules[ticker]
                    return (
                      <div
                        key={ticker}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5"
                        style={{ backgroundColor: T.card, border: `1px solid ${hasOverride ? T.gold : T.inputBorder}` }}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[13px] font-semibold block truncate" style={{ color: T.textPrimary }}>{assetName}</span>
                          {autoSched && !hasOverride && (
                            <p className="text-[10px]" style={{ color: T.textMuted }}>
                              {autoSched.period} · {autoSched.day}일 · 평균 {fmtKrw(autoSched.avgKrw)}
                            </p>
                          )}
                          {hasOverride && (
                            <p className="text-[10px]" style={{ color: T.gold }}>
                              {schedules[ticker].period} · {schedules[ticker].day}일
                              {schedules[ticker].amountKrw > 0 && ` · ${fmtKrw(schedules[ticker].amountKrw)}`}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => openEdit(ticker)}
                          className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg ml-2"
                          style={{ color: T.gold, backgroundColor: 'rgba(201,168,76,0.1)' }}
                        >
                          {hasOverride ? '수정' : '설정'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Manually added tickers (not in history) */}
            {manualOnlyTickers.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold mb-2 px-0.5 uppercase tracking-wider" style={{ color: T.textMuted }}>
                  수동 추가
                </p>
                <div className="space-y-2">
                  {manualOnlyTickers.map((ticker) => {
                    const s = schedules[ticker]
                    return (
                      <div
                        key={ticker}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5"
                        style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[13px] font-semibold block truncate" style={{ color: T.textPrimary }}>{s.assetName || ticker}</span>
                          <p className="text-[10px]" style={{ color: T.textMuted }}>
                            {s.period} · {s.day}일
                            {s.amountKrw > 0 && ` · ${fmtKrw(s.amountKrw)}`}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0 ml-2">
                          <button onClick={() => openEdit(ticker)} className="text-[11px] px-2 py-1 rounded-lg"
                            style={{ color: T.gold, backgroundColor: 'rgba(201,168,76,0.1)' }}>수정</button>
                          <button onClick={() => { removeSchedule(ticker); push('삭제됨', 'success') }} className="text-[11px] px-2 py-1 rounded-lg"
                            style={{ color: T.red, backgroundColor: 'rgba(224,82,82,0.1)' }}>삭제</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Schedule form */}
            {showForm ? (
              <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>
                <p className="text-[13px] font-bold" style={{ color: T.gold }}>
                  {editTicker ? '배당 일정 수정' : '배당 일정 추가'}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1" style={{ color: T.textMuted }}>종목코드</label>
                    <input
                      type="text"
                      value={form.ticker}
                      onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                      placeholder="JEPI"
                      disabled={!!editTicker}
                      className="w-full border rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                      style={{ ...inpStyle, opacity: editTicker ? 0.5 : 1 }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1" style={{ color: T.textMuted }}>종목명</label>
                    <input
                      type="text"
                      value={form.assetName}
                      onChange={(e) => setForm((f) => ({ ...f, assetName: e.target.value }))}
                      placeholder="JP모건 커버드콜"
                      className="w-full border rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                      style={inpStyle}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: T.textMuted }}>배당 주기</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PERIODS.map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePeriodChange(p)}
                        className="py-1.5 text-[11px] font-semibold rounded-lg transition-colors"
                        style={{
                          backgroundColor: form.period === p ? T.gold : T.inputBg,
                          color: form.period === p ? '#0A0A0A' : T.textMuted,
                        }}
                      >{p}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: T.textMuted }}>지급 월</label>
                  <div className="grid grid-cols-6 gap-1">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                      <button
                        key={m}
                        onClick={() => toggleMonth(m)}
                        className="py-1.5 text-[11px] font-semibold rounded-lg transition-colors"
                        style={{
                          backgroundColor: form.months.includes(m) ? T.gold : T.inputBg,
                          color: form.months.includes(m) ? '#0A0A0A' : T.textMuted,
                        }}
                      >{m}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1" style={{ color: T.textMuted }}>지급일</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form.day}
                      onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
                      placeholder="15"
                      min="1" max="31"
                      className="w-full border rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                      style={inpStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1" style={{ color: T.textMuted }}>예상금액 (원)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form.amountKrw}
                      onChange={(e) => setForm((f) => ({ ...f, amountKrw: e.target.value }))}
                      placeholder="50000"
                      className="w-full border rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                      style={inpStyle}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-0.5">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-2 text-[12px] font-bold rounded-xl"
                    style={{ backgroundColor: T.inputBg, color: T.textMuted }}
                  >취소</button>
                  <button
                    onClick={saveSched}
                    className="flex-1 py-2 text-[12px] font-bold rounded-xl"
                    style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
                  >저장</button>
                </div>
              </div>
            ) : (
              <button
                onClick={openAdd}
                className="w-full py-2.5 text-[12px] font-bold rounded-xl"
                style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: T.gold, border: `1px dashed ${T.goldDim}` }}
              >
                + 배당 일정 추가
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
