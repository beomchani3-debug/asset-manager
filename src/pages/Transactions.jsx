import { useState, useMemo, useEffect, useRef } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useSettingsStore from '../store/useSettingsStore'

// ─── Constants ────────────────────────────────────────────────────────────────
const SIDE_FILTER  = ['전체', '매수', '매도', '배당']
const MARKETS      = ['미국', '국내', '일본', '코인']
const BROKERS      = ['농협증권', '메리츠증권', '바이낸스']
const CURRENCIES   = ['KRW', 'USD', 'JPY']
const MKT_CCY      = { 미국: 'USD', 국내: 'KRW', 일본: 'JPY', 코인: 'USD' }

const BADGE_CLS = {
  매수: 'bg-blue-100 text-blue-700',
  매도: 'bg-red-100 text-red-600',
  배당: 'bg-emerald-100 text-emerald-700',
}
const AMT_CLS = {
  매수: 'text-blue-600',
  매도: 'text-red-500',
  배당: 'text-emerald-600',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtKrw = (n) => Math.round(n).toLocaleString('ko-KR') + '원'
const fmtMd  = (d) => (d ? d.slice(5).replace('-', '.') : '')

function todayIso() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function groupByMonth(list) {
  const map = {}
  for (const t of list) {
    const ym = t.date.slice(0, 7)
    ;(map[ym] ??= []).push(t)
  }
  return Object.entries(map).sort((a, b) => (b[0] > a[0] ? 1 : -1))
}

function ymLabel(ym) {
  const [y, m] = ym.split('-')
  return `${y}년 ${+m}월`
}

// ─── TxRow (스와이프 / 길게 누르기 → 삭제) ───────────────────────────────────
function TxRow({ tx, onEdit, onDelete }) {
  const [revealed, setRevealed] = useState(false)
  const startX    = useRef(0)
  const longTimer = useRef(null)
  const wasMoved  = useRef(false)

  function tStart(e) {
    startX.current = e.touches[0].clientX
    wasMoved.current = false
    longTimer.current = setTimeout(() => setRevealed(true), 550)
  }
  function tMove(e) {
    const dx = e.touches[0].clientX - startX.current
    if (Math.abs(dx) > 10) {
      wasMoved.current = true
      clearTimeout(longTimer.current)
      if (dx < -36) setRevealed(true)
      else if (dx > 10) setRevealed(false)
    }
  }
  function tEnd() { clearTimeout(longTimer.current) }
  function handleClick() {
    if (revealed) { setRevealed(false); return }
    if (!wasMoved.current) onEdit()
  }

  return (
    <div className="relative overflow-hidden select-none">
      {/* 삭제 버튼 (뒤에 고정) */}
      <button
        className="absolute right-0 inset-y-0 w-[72px] bg-red-500 flex flex-col items-center justify-center gap-0.5 active:bg-red-600"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" /><path d="M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
        <span className="text-[10px] font-bold text-white">삭제</span>
      </button>

      {/* 행 본문 */}
      <div
        className={`relative bg-white transition-transform duration-200 ${revealed ? '-translate-x-[72px]' : 'translate-x-0'}`}
        onTouchStart={tStart}
        onTouchMove={tMove}
        onTouchEnd={tEnd}
        onClick={handleClick}
      >
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <span className="text-[11px] text-slate-400 tabular-nums w-9 shrink-0 leading-tight">
            {fmtMd(tx.date)}
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{tx.assetName}</p>
            <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">{tx.ticker} · {tx.broker}</p>
          </div>

          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${BADGE_CLS[tx.side] ?? BADGE_CLS['매수']}`}>
            {tx.side}
          </span>

          <div className="text-right shrink-0 min-w-[80px]">
            <p className={`text-[13px] font-semibold tabular-nums leading-tight ${AMT_CLS[tx.side] ?? ''}`}>
              {tx.side === '매도' ? '−' : '+'}{fmtKrw(tx.krwAmount)}
            </p>
            {tx.side !== '배당' && (
              <p className="text-[10px] text-slate-400 tabular-nums leading-tight mt-0.5">
                {tx.quantity.toLocaleString('ko-KR')}주
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── AddEditModal ─────────────────────────────────────────────────────────────
function initForm(tx, fxRates) {
  if (tx) {
    return {
      date: tx.date, side: tx.side, broker: tx.broker,
      assetName: tx.assetName, ticker: tx.ticker,
      market: tx.market, sector: tx.sector ?? '',
      currency: tx.currency,
      price: String(tx.price), quantity: String(tx.quantity),
      fxRate: String(tx.fxRate), krwAmount: String(tx.krwAmount),
      tax: '', memo: tx.memo ?? '',
    }
  }
  const usd = fxRates.USD > 0 ? String(Math.round(fxRates.USD)) : ''
  return {
    date: todayIso(), side: '매수', broker: '농협증권',
    assetName: '', ticker: '', market: '미국', sector: '',
    currency: 'USD', price: '', quantity: '',
    fxRate: usd, krwAmount: '', tax: '', memo: '',
  }
}

function getFxDefault(currency, fxRates) {
  if (currency === 'KRW') return '1'
  if (currency === 'USD' && fxRates.USD > 0) return String(Math.round(fxRates.USD))
  if (currency === 'JPY' && fxRates.JPY > 0) return String(+(fxRates.JPY).toFixed(2))
  return ''
}

function AddEditModal({ tx, suggestions, onClose, onSave, onDelete }) {
  const fxRates   = useSettingsStore((s) => s.settings.fxRates)
  const [form, setFormRaw] = useState(() => initForm(tx, fxRates))
  const [visible, setVisible]       = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [manualKrw, setManualKrw]   = useState(!!tx)   // edit: preserve stored value
  const [showSugg, setShowSugg]     = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const isDividend = form.side === '배당'
  const isKRW      = form.currency === 'KRW'

  // ── 원화금액 자동 계산 ────────────────────────────────────────────────────
  useEffect(() => {
    if (manualKrw) return
    const p  = parseFloat(form.price)    || 0
    const q  = parseFloat(form.quantity) || 0
    const fx = parseFloat(form.fxRate)   || (isKRW ? 1 : 0)
    const tax = parseFloat(form.tax)     || 0

    let krw = 0
    if (isDividend) {
      krw = Math.round(Math.max(0, p * q - tax) * (isKRW ? 1 : fx))
    } else {
      krw = Math.round(p * q * (isKRW ? 1 : fx))
    }
    if (krw > 0) setFormRaw(prev => ({ ...prev, krwAmount: String(krw) }))
  }, [form.price, form.quantity, form.fxRate, form.tax, form.side, form.currency, isKRW, isDividend, manualKrw])

  function set(key, val) {
    setFormRaw(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'market') {
        next.currency = MKT_CCY[val]
        next.fxRate   = getFxDefault(next.currency, fxRates)
        if (val === '코인') next.broker = '바이낸스'
      }
      if (key === 'currency') {
        next.fxRate = getFxDefault(val, fxRates)
      }
      if (key === 'side' || key === 'market' || key === 'currency') {
        setManualKrw(false)
      }
      return next
    })
  }

  function close() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  // ── 종목 자동완성 ──────────────────────────────────────────────────────────
  const filteredSugg = useMemo(() => {
    if (!form.assetName) return []
    const q = form.assetName.toLowerCase()
    return suggestions.filter(s =>
      s.assetName.toLowerCase().includes(q) || s.ticker.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [form.assetName, suggestions])

  function selectSuggestion(s) {
    setFormRaw(prev => ({
      ...prev,
      assetName: s.assetName,
      ticker:    s.ticker,
      market:    s.market,
      sector:    s.sector ?? '',
      currency:  s.currency,
      fxRate:    getFxDefault(s.currency, fxRates),
    }))
    setManualKrw(false)
    setShowSugg(false)
  }

  // ── 배당 표시값 ────────────────────────────────────────────────────────────
  const divNetOrig = isDividend
    ? Math.max(0, (parseFloat(form.price)||0) * (parseFloat(form.quantity)||0) - (parseFloat(form.tax)||0))
    : 0
  const divKrwAmt = isDividend
    ? Math.round(divNetOrig * (isKRW ? 1 : (parseFloat(form.fxRate)||0)))
    : 0

  // ── 저장 ─────────────────────────────────────────────────────────────────
  function handleSave() {
    const p   = parseFloat(form.price)    || 0
    const q   = parseFloat(form.quantity) || 0
    const fx  = parseFloat(form.fxRate)   || 1
    const krw = isDividend
      ? divKrwAmt
      : (manualKrw ? parseFloat(form.krwAmount) || Math.round(p * q * (isKRW ? 1 : fx))
                   : Math.round(p * q * (isKRW ? 1 : fx)))

    onSave({
      date: form.date, side: form.side, broker: form.broker,
      assetName: form.assetName.trim(),
      ticker:    form.ticker.trim().toUpperCase(),
      market:    form.market, sector: form.sector.trim(),
      currency:  form.currency,
      price:     p, quantity: q,
      fxRate:    isKRW ? 1 : fx,
      krwAmount: krw,
      memo:      form.memo.trim(),
    })
    close()
  }

  const canSave =
    form.date && form.assetName.trim() && form.ticker.trim() &&
    parseFloat(form.price) > 0 && parseFloat(form.quantity) > 0

  // ── 공통 인풋 스타일 ────────────────────────────────────────────────────────
  const cls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-blue-400 transition-colors'
  const lbl = 'block text-[11px] font-semibold text-slate-500 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={close}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 max-h-[92vh] overflow-y-auto no-scrollbar ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-white z-10">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-5 pt-2 pb-12 space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold text-slate-900">{tx ? '거래 수정' : '거래 추가'}</h3>
            <button onClick={close} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm active:opacity-70">✕</button>
          </div>

          {/* ── 거래유형 ── */}
          <div className="flex gap-2">
            {['매수', '매도', '배당'].map((s) => {
              const on = form.side === s
              const c  = s === '매수' ? 'bg-blue-600' : s === '매도' ? 'bg-red-500' : 'bg-emerald-500'
              return (
                <button key={s} onClick={() => set('side', s)}
                  className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${on ? `${c} text-white` : 'bg-slate-100 text-slate-500'}`}>
                  {s}
                </button>
              )
            })}
          </div>

          {/* ── 거래일 + 증권사 ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>거래일</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={cls} />
            </div>
            <div>
              <label className={lbl}>증권사</label>
              <select value={form.broker} onChange={(e) => set('broker', e.target.value)} className={cls}>
                {BROKERS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* ── 종목명 (자동완성) ── */}
          <div>
            <label className={lbl}>종목명</label>
            <input
              value={form.assetName}
              onChange={(e) => { set('assetName', e.target.value); setShowSugg(true) }}
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 180)}
              placeholder="삼성전자"
              className={cls}
            />
            {showSugg && filteredSugg.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {filteredSugg.map(s => (
                  <button
                    key={`${s.ticker}::${s.broker}`}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                    className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-semibold active:opacity-70"
                  >
                    {s.assetName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 티커 + 시장 ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>티커</label>
              <input
                value={form.ticker}
                onChange={(e) => set('ticker', e.target.value.toUpperCase())}
                placeholder="AAPL"
                className={`${cls} font-mono`}
              />
            </div>
            <div>
              <label className={lbl}>시장</label>
              <select value={form.market} onChange={(e) => set('market', e.target.value)} className={cls}>
                {MARKETS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* ── 섹터 ── */}
          <div>
            <label className={lbl}>섹터 (선택)</label>
            <input value={form.sector} onChange={(e) => set('sector', e.target.value)}
              placeholder="리츠, ETF, 단기채권 등" className={cls} />
          </div>

          {/* ── 배당 통화 선택 ── */}
          {isDividend && (
            <div>
              <label className={lbl}>배당 통화</label>
              <div className="flex gap-2">
                {CURRENCIES.map(c => (
                  <button key={c} onClick={() => set('currency', c)}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-bold transition-colors ${form.currency === c ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ════ 매수 / 매도 필드 ════ */}
          {!isDividend && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>거래단가 ({form.currency})</label>
                  <input type="number" inputMode="decimal" value={form.price}
                    onChange={(e) => set('price', e.target.value)} placeholder="0" className={cls} />
                </div>
                <div>
                  <label className={lbl}>수량</label>
                  <input type="number" inputMode="decimal" value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)} placeholder="0" className={cls} />
                </div>
              </div>

              {!isKRW && (
                <div>
                  <label className={lbl}>환율 (원/{form.currency})</label>
                  <input type="number" inputMode="decimal" value={form.fxRate}
                    onChange={(e) => { setManualKrw(false); set('fxRate', e.target.value) }}
                    placeholder="0" className={cls} />
                </div>
              )}

              {/* 원화금액: 자동계산 + 수동 override */}
              <div>
                <label className={lbl}>원화금액</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number" inputMode="decimal"
                    value={form.krwAmount}
                    onChange={(e) => { setManualKrw(true); setFormRaw(p => ({ ...p, krwAmount: e.target.value })) }}
                    placeholder="자동 계산"
                    className={`${cls} flex-1`}
                  />
                  {manualKrw && (
                    <button
                      onClick={() => setManualKrw(false)}
                      title="자동 계산으로 초기화"
                      className="shrink-0 w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-base active:opacity-70"
                    >↺</button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ════ 배당 필드 ════ */}
          {isDividend && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>주당배당금 ({form.currency})</label>
                  <input type="number" inputMode="decimal" value={form.price}
                    onChange={(e) => set('price', e.target.value)} placeholder="0" className={cls} />
                </div>
                <div>
                  <label className={lbl}>수량 (주)</label>
                  <input type="number" inputMode="decimal" value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)} placeholder="0" className={cls} />
                </div>
              </div>

              <div>
                <label className={lbl}>세금 ({form.currency}, 선택)</label>
                <input type="number" inputMode="decimal" value={form.tax}
                  onChange={(e) => set('tax', e.target.value)} placeholder="0" className={cls} />
              </div>

              {/* 배당 계산 요약 */}
              <div className="rounded-2xl bg-slate-50 px-4 py-3.5 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-slate-500">실수령액 ({form.currency})</span>
                  <span className="text-[13px] font-semibold text-slate-700 tabular-nums">
                    {divNetOrig.toLocaleString('ko-KR')} {form.currency}
                  </span>
                </div>

                {!isKRW && (
                  <>
                    <div className="h-px bg-slate-200" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-slate-500 shrink-0">환율 (원/{form.currency})</span>
                      <input
                        type="number" inputMode="decimal" value={form.fxRate}
                        onChange={(e) => set('fxRate', e.target.value)}
                        placeholder="0"
                        className="w-28 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:border-blue-400 text-right tabular-nums"
                      />
                    </div>
                  </>
                )}

                <div className="h-px bg-slate-200" />
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-semibold text-slate-600">원화 수령액</span>
                  <span className="text-[14px] font-bold text-emerald-600 tabular-nums">
                    {divKrwAmt.toLocaleString('ko-KR')}원
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ── 메모 ── */}
          <div>
            <label className={lbl}>메모 (선택)</label>
            <input value={form.memo} onChange={(e) => set('memo', e.target.value)}
              placeholder="" className={cls} />
          </div>

          {/* ── 저장 ── */}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full py-3.5 bg-blue-600 text-white text-[14px] font-bold rounded-2xl disabled:opacity-40 active:opacity-80 transition-opacity"
          >
            {tx ? '수정 완료' : '거래 저장'}
          </button>

          {/* ── 삭제 (수정 모드) ── */}
          {tx && (
            confirmDel ? (
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 text-[13px] font-semibold rounded-2xl active:opacity-80">
                  취소
                </button>
                <button onClick={() => { onDelete(tx.id); close() }}
                  className="flex-1 py-3 bg-red-500 text-white text-[13px] font-semibold rounded-2xl active:opacity-80">
                  삭제 확인
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                className="w-full py-3 bg-slate-50 text-red-400 text-[13px] font-semibold rounded-2xl border border-slate-100 active:opacity-80">
                거래 삭제
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export default function Transactions() {
  const [sideFilter, setSideFilter] = useState('전체')
  const [search, setSearch]         = useState('')
  const [editTx, setEditTx]         = useState(null)
  const [modalOpen, setModalOpen]   = useState(false)

  const transactions      = useTransactionStore((s) => s.transactions)
  const addTransaction    = useTransactionStore((s) => s.addTransaction)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)

  // 기존 종목 자동완성 (최초 등장 기준)
  const suggestions = useMemo(() => {
    const map = new Map()
    for (const t of transactions) {
      const key = `${t.ticker}::${t.broker}`
      if (!map.has(key)) map.set(key, {
        assetName: t.assetName, ticker: t.ticker,
        market: t.market, sector: t.sector ?? '',
        currency: t.currency, broker: t.broker,
      })
    }
    return [...map.values()]
  }, [transactions])

  // 필터 + 검색 + 정렬
  const filtered = useMemo(() => {
    let list = transactions
    if (sideFilter !== '전체') list = list.filter(t => t.side === sideFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(t =>
        t.assetName.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => (b.date > a.date ? 1 : -1))
  }, [transactions, sideFilter, search])

  const grouped = useMemo(() => groupByMonth(filtered), [filtered])

  function openAdd() { setEditTx(null); setModalOpen(true) }
  function openEdit(tx) { setEditTx(tx); setModalOpen(true) }
  function handleSave(data) {
    if (editTx) updateTransaction(editTx.id, data)
    else        addTransaction(data)
  }

  return (
    <div className="relative flex flex-col h-full">

      {/* ── 검색바 + 필터 ──────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-4 pt-3 pb-3 space-y-2.5">
        {/* 검색 입력 + 추가 버튼 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-slate-400 shrink-0">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="종목명 또는 티커 검색"
              className="flex-1 bg-transparent text-[13px] outline-none text-slate-700 placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-400 active:opacity-70">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={openAdd}
            aria-label="거래 추가"
            className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-light shadow-sm shadow-blue-200 active:opacity-80 shrink-0"
          >+</button>
        </div>

        {/* 타입 필터 */}
        <div className="flex gap-1.5">
          {SIDE_FILTER.map(s => (
            <button key={s} onClick={() => setSideFilter(s)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                sideFilter === s ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'bg-slate-100 text-slate-500'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── 거래 목록 ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {filtered.length > 0 ? (
          <div className="p-4 pb-20 space-y-4">
            {grouped.map(([ym, txs]) => (
              <section key={ym}>
                <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                  {ymLabel(ym)}
                </h2>
                <div className="rounded-2xl bg-white shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                  {txs.map(t => (
                    <TxRow key={t.id} tx={t}
                      onEdit={() => openEdit(t)}
                      onDelete={() => deleteTransaction(t.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">📋</div>
            <p className="text-[15px] font-semibold text-slate-600">
              {search
                ? `'${search}' 검색 결과 없음`
                : sideFilter !== '전체'
                  ? `${sideFilter} 내역이 없습니다`
                  : '거래 내역이 없습니다'}
            </p>
            {!search && (
              <p className="text-[13px] text-slate-400 leading-relaxed">
                + 버튼을 눌러 거래를 추가해보세요
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── 플로팅 버튼 ────────────────────────────────────────────────── */}
      <button
        onClick={openAdd}
        aria-label="거래 추가"
        className="absolute bottom-4 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-300 flex items-center justify-center text-3xl font-light active:scale-95 transition-transform z-30 leading-none"
      >+</button>

      {/* ── 바텀 시트 ─────────────────────────────────────────────────── */}
      {modalOpen && (
        <AddEditModal
          tx={editTx}
          suggestions={suggestions}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onDelete={deleteTransaction}
        />
      )}
    </div>
  )
}
