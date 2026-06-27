import { useState, useMemo, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import useTransactionStore from '../store/useTransactionStore'
import useSettingsStore from '../store/useSettingsStore'
import { T } from '../theme'

// ─── Constants ────────────────────────────────────────────────────────────────
const SIDE_FILTER  = ['전체', '매수', '매도', '배당']
const MARKETS      = ['미국', '국내']
const BROKERS      = ['농협증권', '메리츠증권']
const CURRENCIES   = ['KRW', 'USD']
const MKT_CCY      = { 미국: 'USD', 국내: 'KRW' }

const BADGE_STYLE = {
  매수: { backgroundColor: '#0A1525', color: T.blue  },
  매도: { backgroundColor: '#200A0A', color: T.red   },
  배당: { backgroundColor: '#0D1A0D', color: T.green },
}
const AMT_COLOR = {
  매수: T.blue,
  매도: T.red,
  배당: T.green,
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

// ─── TxRow ────────────────────────────────────────────────────────────────────
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
      <button
        className="absolute right-0 inset-y-0 w-[72px] flex flex-col items-center justify-center gap-0.5 active:opacity-80"
        style={{ backgroundColor: T.red }}
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

      <div
        className={`relative transition-transform duration-200 ${revealed ? '-translate-x-[72px]' : 'translate-x-0'}`}
        style={{ backgroundColor: T.card }}
        onTouchStart={tStart}
        onTouchMove={tMove}
        onTouchEnd={tEnd}
        onClick={handleClick}
      >
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <span className="text-[11px] tabular-nums w-9 shrink-0 leading-tight" style={{ color: T.textMuted }}>
            {fmtMd(tx.date)}
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: T.textPrimary }}>{tx.assetName}</p>
            <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: T.textMuted }}>{tx.ticker} · {tx.broker}</p>
          </div>

          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
            style={BADGE_STYLE[tx.side] ?? BADGE_STYLE['매수']}
          >
            {tx.side}
          </span>

          <div className="text-right shrink-0 min-w-[80px]">
            <p className="text-[13px] font-semibold tabular-nums leading-tight" style={{ color: AMT_COLOR[tx.side] ?? T.textPrimary }}>
              {tx.side === '매도' ? '−' : '+'}{fmtKrw(tx.krwAmount)}
            </p>
            {tx.side !== '배당' && (
              <p className="text-[10px] tabular-nums leading-tight mt-0.5" style={{ color: T.textMuted }}>
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
  return ''
}

function AddEditModal({ tx, suggestions, onClose, onSave, onDelete, defaultSide }) {
  const fxRates   = useSettingsStore((s) => s.settings.fxRates)
  const [form, setFormRaw] = useState(() => {
    const f = initForm(tx, fxRates)
    if (!tx && defaultSide) f.side = defaultSide
    return f
  })
  const [visible, setVisible]       = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [manualKrw, setManualKrw]   = useState(!!tx)
  const [showSugg, setShowSugg]     = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const isDividend = form.side === '배당'
  const isKRW      = form.currency === 'KRW'

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

  const divNetOrig = isDividend
    ? Math.max(0, (parseFloat(form.price)||0) * (parseFloat(form.quantity)||0) - (parseFloat(form.tax)||0))
    : 0
  const divKrwAmt = isDividend
    ? Math.round(divNetOrig * (isKRW ? 1 : (parseFloat(form.fxRate)||0)))
    : 0

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

  const inpStyle = { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.textPrimary }
  const lbl = 'block text-[11px] font-semibold mb-1.5'

  const sideColor = (s) => s === '매수' ? T.blue : s === '매도' ? T.red : T.green

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={close}>
      <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`relative w-full max-w-[430px] rounded-t-3xl shadow-2xl transition-transform duration-300 max-h-[92vh] overflow-y-auto no-scrollbar ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ backgroundColor: T.card, border: `1px solid ${T.gold}`, borderBottom: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sticky top-0 z-10" style={{ backgroundColor: T.card }}>
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: T.goldDim }} />
        </div>

        <div className="px-5 pt-2 pb-12 space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold" style={{ color: T.goldLight }}>{tx ? '거래 수정' : '거래 추가'}</h3>
            <button
              onClick={close}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm active:opacity-70"
              style={{ backgroundColor: T.inputBg, color: T.textMuted }}
            >✕</button>
          </div>

          {/* 거래유형 */}
          <div className="flex gap-2">
            {['매수', '매도', '배당'].map((s) => {
              const on = form.side === s
              return (
                <button
                  key={s}
                  onClick={() => set('side', s)}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-colors"
                  style={on
                    ? { backgroundColor: sideColor(s), color: '#0A0A0A' }
                    : { backgroundColor: T.inputBg, color: T.textMuted }
                  }
                >
                  {s}
                </button>
              )
            })}
          </div>

          {/* 거래일 + 증권사 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} style={{ color: T.textMuted }}>거래일</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                style={inpStyle} />
            </div>
            <div>
              <label className={lbl} style={{ color: T.textMuted }}>증권사</label>
              <select value={form.broker} onChange={(e) => set('broker', e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                style={inpStyle}>
                {BROKERS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* 종목명 (자동완성) */}
          <div>
            <label className={lbl} style={{ color: T.textMuted }}>종목명</label>
            <input
              value={form.assetName}
              onChange={(e) => { set('assetName', e.target.value); setShowSugg(true) }}
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 180)}
              placeholder="삼성전자"
              className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
              style={inpStyle}
            />
            {showSugg && filteredSugg.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {filteredSugg.map(s => (
                  <button
                    key={`${s.ticker}::${s.broker}`}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                    className="text-[11px] px-2.5 py-1 rounded-full font-semibold active:opacity-70"
                    style={{ backgroundColor: 'rgba(91,155,213,0.1)', color: T.blue }}
                  >
                    {s.assetName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 티커 + 시장 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} style={{ color: T.textMuted }}>티커</label>
              <input
                value={form.ticker}
                onChange={(e) => set('ticker', e.target.value.toUpperCase())}
                placeholder="AAPL"
                className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors font-mono"
                style={inpStyle}
              />
            </div>
            <div>
              <label className={lbl} style={{ color: T.textMuted }}>시장</label>
              <select value={form.market} onChange={(e) => set('market', e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                style={inpStyle}>
                {MARKETS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* 섹터 */}
          <div>
            <label className={lbl} style={{ color: T.textMuted }}>섹터 (선택)</label>
            <input value={form.sector} onChange={(e) => set('sector', e.target.value)}
              placeholder="리츠, ETF, 단기채권 등"
              className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
              style={inpStyle} />
          </div>

          {/* 배당 통화 선택 */}
          {isDividend && (
            <div>
              <label className={lbl} style={{ color: T.textMuted }}>배당 통화</label>
              <div className="flex gap-2">
                {CURRENCIES.map(c => (
                  <button key={c} onClick={() => set('currency', c)}
                    className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-colors"
                    style={form.currency === c
                      ? { backgroundColor: T.goldDim, color: T.goldLight }
                      : { backgroundColor: T.inputBg, color: T.textMuted }
                    }>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 매수 / 매도 필드 */}
          {!isDividend && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl} style={{ color: T.textMuted }}>거래단가 ({form.currency})</label>
                  <input type="number" inputMode="decimal" value={form.price}
                    onChange={(e) => set('price', e.target.value)} placeholder="0"
                    className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                    style={inpStyle} />
                </div>
                <div>
                  <label className={lbl} style={{ color: T.textMuted }}>수량</label>
                  <input type="number" inputMode="decimal" value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)} placeholder="0"
                    className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                    style={inpStyle} />
                </div>
              </div>

              {!isKRW && (
                <div>
                  <label className={lbl} style={{ color: T.textMuted }}>환율 (원/{form.currency})</label>
                  <input type="number" inputMode="decimal" value={form.fxRate}
                    onChange={(e) => { setManualKrw(false); set('fxRate', e.target.value) }}
                    placeholder="0"
                    className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                    style={inpStyle} />
                </div>
              )}

              <div>
                <label className={lbl} style={{ color: T.textMuted }}>원화금액</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number" inputMode="decimal"
                    value={form.krwAmount}
                    onChange={(e) => { setManualKrw(true); setFormRaw(p => ({ ...p, krwAmount: e.target.value })) }}
                    placeholder="자동 계산"
                    className="flex-1 border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                    style={inpStyle}
                  />
                  {manualKrw && (
                    <button
                      onClick={() => setManualKrw(false)}
                      title="자동 계산으로 초기화"
                      className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base active:opacity-70"
                      style={{ backgroundColor: T.inputBg, color: T.textMuted }}
                    >↺</button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 배당 필드 */}
          {isDividend && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl} style={{ color: T.textMuted }}>주당배당금 ({form.currency})</label>
                  <input type="number" inputMode="decimal" value={form.price}
                    onChange={(e) => set('price', e.target.value)} placeholder="0"
                    className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                    style={inpStyle} />
                </div>
                <div>
                  <label className={lbl} style={{ color: T.textMuted }}>수량 (주)</label>
                  <input type="number" inputMode="decimal" value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)} placeholder="0"
                    className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                    style={inpStyle} />
                </div>
              </div>

              <div>
                <label className={lbl} style={{ color: T.textMuted }}>세금 ({form.currency}, 선택)</label>
                <input type="number" inputMode="decimal" value={form.tax}
                  onChange={(e) => set('tax', e.target.value)} placeholder="0"
                  className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                  style={inpStyle} />
              </div>

              <div className="rounded-2xl px-4 py-3.5 space-y-2.5" style={{ backgroundColor: T.inputBg, border: `1px solid ${T.inputBorder}` }}>
                <div className="flex justify-between items-center">
                  <span className="text-[12px]" style={{ color: T.textMuted }}>실수령액 ({form.currency})</span>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: T.textPrimary }}>
                    {divNetOrig.toLocaleString('ko-KR')} {form.currency}
                  </span>
                </div>

                {!isKRW && (
                  <>
                    <div className="h-px" style={{ backgroundColor: T.divider }} />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] shrink-0" style={{ color: T.textMuted }}>환율 (원/{form.currency})</span>
                      <input
                        type="number" inputMode="decimal" value={form.fxRate}
                        onChange={(e) => set('fxRate', e.target.value)}
                        placeholder="0"
                        className="w-28 border rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:border-[#C9A84C] text-right tabular-nums"
                        style={{ backgroundColor: T.card, borderColor: T.inputBorder, color: T.textPrimary }}
                      />
                    </div>
                  </>
                )}

                <div className="h-px" style={{ backgroundColor: T.divider }} />
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-semibold" style={{ color: T.textPrimary }}>원화 수령액</span>
                  <span className="text-[14px] font-bold tabular-nums" style={{ color: T.green }}>
                    {divKrwAmt.toLocaleString('ko-KR')}원
                  </span>
                </div>
              </div>
            </>
          )}

          {/* 메모 */}
          <div>
            <label className={lbl} style={{ color: T.textMuted }}>메모 (선택)</label>
            <input value={form.memo} onChange={(e) => set('memo', e.target.value)}
              placeholder=""
              className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
              style={inpStyle} />
          </div>

          {/* 저장 */}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full py-3.5 text-[14px] font-bold rounded-2xl disabled:opacity-40 active:opacity-80 transition-opacity"
            style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
          >
            {tx ? '수정 완료' : '거래 저장'}
          </button>

          {/* 삭제 (수정 모드) */}
          {tx && (
            confirmDel ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDel(false)}
                  className="flex-1 py-3 text-[13px] font-semibold rounded-2xl active:opacity-80"
                  style={{ backgroundColor: T.inputBg, color: T.textPrimary }}
                >
                  취소
                </button>
                <button
                  onClick={() => { onDelete(tx.id); close() }}
                  className="flex-1 py-3 text-[13px] font-semibold rounded-2xl active:opacity-80 text-white"
                  style={{ backgroundColor: T.red }}
                >
                  삭제 확인
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                className="w-full py-3 text-[13px] font-semibold rounded-2xl border active:opacity-80"
                style={{ backgroundColor: 'transparent', color: T.red, borderColor: T.inputBorder }}
              >
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
  const location = useLocation()
  const [sideFilter, setSideFilter] = useState('전체')
  const [search, setSearch]         = useState('')
  const [editTx, setEditTx]         = useState(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [autoSide, setAutoSide]     = useState(null)

  useEffect(() => {
    if (location.state?.autoOpen) {
      setAutoSide(location.state.defaultSide ?? '매수')
      setEditTx(null)
      setModalOpen(true)
      window.history.replaceState({}, '')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const transactions      = useTransactionStore((s) => s.transactions)
  const addTransaction    = useTransactionStore((s) => s.addTransaction)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)

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
    <div className="relative flex flex-col h-full" style={{ backgroundColor: T.bg }}>

      {/* 검색바 + 필터 */}
      <div
        className="shrink-0 border-b px-4 pt-3 pb-3 space-y-2.5"
        style={{ backgroundColor: T.card, borderColor: T.gold }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ backgroundColor: T.inputBg }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0" style={{ color: T.textMuted }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="종목명 또는 티커 검색"
              className="flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: T.textPrimary }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="active:opacity-70" style={{ color: T.textMuted }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={openAdd}
            aria-label="거래 추가"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl font-light active:opacity-80 shrink-0"
            style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
          >+</button>
        </div>

        <div className="flex gap-1.5">
          {SIDE_FILTER.map(s => (
            <button
              key={s}
              onClick={() => setSideFilter(s)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
              style={sideFilter === s
                ? { backgroundColor: T.gold, color: '#0A0A0A' }
                : { backgroundColor: T.inputBg, color: T.textMuted }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 거래 목록 */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {filtered.length > 0 ? (
          <div className="p-4 pb-20 space-y-4">
            {grouped.map(([ym, txs]) => (
              <section key={ym}>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: T.textMuted }}>
                  {ymLabel(ym)}
                </h2>
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>
                  {txs.map((t, i) => (
                    <div key={t.id} style={i > 0 ? { borderTop: `1px solid ${T.divider}` } : {}}>
                      <TxRow tx={t}
                        onEdit={() => openEdit(t)}
                        onDelete={() => deleteTransaction(t.id)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>📋</div>
            <p className="text-[15px] font-semibold" style={{ color: T.textPrimary }}>
              {search
                ? `'${search}' 검색 결과 없음`
                : sideFilter !== '전체'
                  ? `${sideFilter} 내역이 없습니다`
                  : '거래 내역이 없습니다'}
            </p>
            {!search && (
              <p className="text-[13px] leading-relaxed" style={{ color: T.textMuted }}>
                + 버튼을 눌러 거래를 추가해보세요
              </p>
            )}
          </div>
        )}
      </div>

      {/* 플로팅 버튼 */}
      <button
        onClick={openAdd}
        aria-label="거래 추가"
        className="absolute bottom-4 right-4 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-3xl font-light active:scale-95 transition-transform z-30 leading-none"
        style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
      >+</button>

      {modalOpen && (
        <AddEditModal
          tx={editTx}
          suggestions={suggestions}
          defaultSide={autoSide}
          onClose={() => { setModalOpen(false); setAutoSide(null) }}
          onSave={handleSave}
          onDelete={deleteTransaction}
        />
      )}
    </div>
  )
}
