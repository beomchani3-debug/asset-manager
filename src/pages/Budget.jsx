import { useState, useMemo, useEffect, useRef } from 'react'
import useCashFlowStore from '../store/useCashFlowStore'

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_TABS = ['수입', '고정비', '변동지출']

const CATEGORIES = {
  수입: ['월급', '배당금', '부동산', '사업', '기타'],
  고정비: ['유튜브', '넷플릭스', 'OpenAI', '교회 헌금', '보험', '교통비', '유류비', '지민이 용돈', '파킹통장', '생활체육센터', '기타'],
  변동지출: ['꾸밈비', '용돈', '식비', '외식비', '카드값', '생필품', '의료비', '경조사비', '환전', '기타'],
}

const CAT_ICON = {
  월급: '💼', 배당금: '📈', 부동산: '🏠', 사업: '🏢', 기타: '💰',
  유튜브: '▶️', 넷플릭스: '🎬', OpenAI: '🤖', '교회 헌금': '⛪', 보험: '🛡️',
  교통비: '🚇', 유류비: '⛽', '지민이 용돈': '👧', 파킹통장: '🅿️', 생활체육센터: '🏋️',
  꾸밈비: '💄', 용돈: '💵', 식비: '🍱', 외식비: '🍽️', 카드값: '💳',
  생필품: '🧴', 의료비: '🏥', 경조사비: '🎁', 환전: '💱',
}
const icon = (cat) => CAT_ICON[cat] ?? '📌'

const TYPE_COLOR = {
  수입:    { badge: 'bg-blue-100 text-blue-700',    bar: 'bg-blue-500',   amt: 'text-blue-600',   card: 'bg-blue-50',  label: 'text-blue-400' },
  고정비:  { badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-400', amt: 'text-orange-600', card: 'bg-orange-50', label: 'text-orange-400' },
  변동지출:{ badge: 'bg-red-100 text-red-600',       bar: 'bg-red-500',    amt: 'text-red-500',    card: 'bg-red-50',   label: 'text-red-400' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtW  = (n) => Math.round(n).toLocaleString('ko-KR') + '원'
const fmtMd = (d) => (d ? d.slice(5).replace('-', '.') : '')

function todayIso() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
}

function currentYM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function ymDisplay(ym) {
  const [y, m] = ym.split('-')
  return `${y}년 ${+m}월`
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function groupByDate(list) {
  const map = {}
  for (const c of list) {
    ;(map[c.date] ??= []).push(c)
  }
  return Object.entries(map).sort((a, b) => (b[0] > a[0] ? 1 : -1))
}

// ─── CashFlowRow (스와이프 삭제) ──────────────────────────────────────────────
function CfRow({ cf, onDelete }) {
  const [revealed, setRevealed] = useState(false)
  const startX   = useRef(0)
  const longTimer = useRef(null)
  const wasMoved = useRef(false)
  const { amt } = TYPE_COLOR[cf.type] ?? TYPE_COLOR['수입']

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
  function handleClick() { if (revealed) setRevealed(false) }

  const color = TYPE_COLOR[cf.type] ?? TYPE_COLOR['수입']
  const sign  = cf.type === '수입' ? '+' : '−'

  return (
    <div className="relative overflow-hidden select-none">
      <button
        className="absolute right-0 inset-y-0 w-[68px] bg-red-500 flex flex-col items-center justify-center gap-0.5 active:bg-red-600"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
        <span className="text-[10px] font-bold text-white">삭제</span>
      </button>

      <div
        className={`relative bg-white transition-transform duration-200 ${revealed ? '-translate-x-[68px]' : 'translate-x-0'}`}
        onTouchStart={tStart} onTouchMove={tMove} onTouchEnd={tEnd} onClick={handleClick}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className={`w-9 h-9 rounded-xl ${color.card} flex items-center justify-center text-lg shrink-0`}>
            {icon(cf.category)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{cf.category}</p>
            {cf.memo && (
              <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">{cf.memo}</p>
            )}
          </div>
          <span className={`text-[13px] font-bold tabular-nums shrink-0 ${color.amt}`}>
            {sign}{fmtW(cf.amount)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── AddModal ─────────────────────────────────────────────────────────────────
function AddModal({ onClose, onSave }) {
  const [visible, setVisible]   = useState(false)
  const [type, setType]         = useState('수입')
  const [date, setDate]         = useState(todayIso())
  const [category, setCategory] = useState('월급')
  const [customCat, setCustomCat] = useState('')
  const [amount, setAmount]     = useState('')
  const [memo, setMemo]         = useState('')

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  // 타입 변경 시 카테고리 기본값 초기화
  useEffect(() => {
    setCategory(CATEGORIES[type][0])
    setCustomCat('')
  }, [type])

  function close() { setVisible(false); setTimeout(onClose, 300) }

  function handleSave() {
    const finalCat = category === '기타' && customCat.trim() ? customCat.trim() : category
    onSave({ date, type, category: finalCat, amount: parseFloat(amount) || 0, memo: memo.trim() })
    close()
  }

  const canSave = date && parseFloat(amount) > 0 && (category !== '기타' || customCat.trim())
  const cats    = CATEGORIES[type]
  const color   = TYPE_COLOR[type]

  const lbl = 'block text-[11px] font-semibold text-slate-500 mb-1.5'
  const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-blue-400 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={close}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 max-h-[92vh] overflow-y-auto no-scrollbar ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-white z-10">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-5 pt-2 pb-12 space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold text-slate-900">내역 추가</h3>
            <button onClick={close} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm active:opacity-70">✕</button>
          </div>

          {/* 유형 탭 */}
          <div className="flex gap-2">
            {TYPE_TABS.map((t) => {
              const on = type === t
              const c  = t === '수입' ? 'bg-blue-600' : t === '고정비' ? 'bg-orange-500' : 'bg-red-500'
              return (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-colors ${on ? `${c} text-white` : 'bg-slate-100 text-slate-500'}`}>
                  {t}
                </button>
              )
            })}
          </div>

          {/* 날짜 + 금액 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>날짜</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>금액 (원)</label>
              <input
                type="number" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0" className={inp}
              />
            </div>
          </div>

          {/* 카테고리 선택 */}
          <div>
            <label className={lbl}>카테고리</label>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                    category === c
                      ? `${color.badge} border-transparent`
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  <span>{icon(c)}</span>
                  <span>{c}</span>
                </button>
              ))}
            </div>
            {category === '기타' && (
              <input
                value={customCat}
                onChange={(e) => setCustomCat(e.target.value)}
                placeholder="카테고리 직접 입력"
                className={`${inp} mt-2`}
              />
            )}
          </div>

          {/* 메모 */}
          <div>
            <label className={lbl}>메모 (선택)</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)}
              placeholder="" className={inp} />
          </div>

          {/* 저장 */}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full py-3.5 bg-blue-600 text-white text-[14px] font-bold rounded-2xl disabled:opacity-40 active:opacity-80 transition-opacity"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Budget (가계부) ─────────────────────────────────────────────────────────
export default function Budget() {
  const [ym, setYm]           = useState(currentYM())
  const [catTab, setCatTab]   = useState('고정비')
  const [modalOpen, setModalOpen] = useState(false)

  const cashFlows   = useCashFlowStore((s) => s.cashFlows)
  const addCashFlow = useCashFlowStore((s) => s.addCashFlow)
  const deleteCashFlow = useCashFlowStore((s) => s.deleteCashFlow)

  // 현재 월 필터
  const monthFlows = useMemo(
    () => cashFlows.filter((c) => c.date.startsWith(ym)),
    [cashFlows, ym]
  )

  // 요약
  const summary = useMemo(() => {
    const income   = monthFlows.filter(c => c.type === '수입').reduce((s, c) => s + c.amount, 0)
    const fixed    = monthFlows.filter(c => c.type === '고정비').reduce((s, c) => s + c.amount, 0)
    const variable = monthFlows.filter(c => c.type === '변동지출').reduce((s, c) => s + c.amount, 0)
    return { income, fixed, variable, net: income - fixed - variable }
  }, [monthFlows])

  // 카테고리별 분석 (고정비 / 변동지출)
  const catBreakdown = useMemo(() => {
    const filtered = monthFlows.filter(c => c.type === catTab)
    const total    = filtered.reduce((s, c) => s + c.amount, 0)
    const map      = {}
    for (const c of filtered) map[c.category] = (map[c.category] ?? 0) + c.amount
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({ cat, amt, pct: total > 0 ? (amt / total) * 100 : 0 }))
  }, [monthFlows, catTab])

  // 날짜별 그룹 (내역 리스트)
  const grouped = useMemo(
    () => groupByDate([...monthFlows].sort((a, b) => (b.date > a.date ? 1 : -1))),
    [monthFlows]
  )

  function handleSave(data) { addCashFlow(data) }

  const netColor = summary.net >= 0 ? 'text-blue-600' : 'text-red-500'
  const netSign  = summary.net >= 0 ? '+' : '−'

  return (
    <div className="relative flex flex-col h-full">

      {/* ── 월 네비게이션 ────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setYm(shiftMonth(ym, -1))}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:opacity-70"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <span className="text-[15px] font-bold text-slate-800">{ymDisplay(ym)}</span>
        <button
          onClick={() => setYm(shiftMonth(ym, 1))}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:opacity-70"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* ── 스크롤 영역 ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {monthFlows.length === 0 ? (
          /* 빈 상태 */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">📒</div>
            <p className="text-[15px] font-semibold text-slate-600">이번달 내역이 없어요</p>
            <p className="text-[13px] text-slate-400 leading-relaxed">추가해보세요!</p>
          </div>
        ) : (
          <div className="p-4 pb-20 space-y-4">

            {/* ── 요약 카드 ── */}
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-4 space-y-3">
              {/* 수입 / 고정비 / 변동지출 3열 */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: '수입',    val: summary.income },
                  { type: '고정비',  val: summary.fixed },
                  { type: '변동지출',val: summary.variable },
                ].map(({ type, val }) => {
                  const c = TYPE_COLOR[type]
                  return (
                    <div key={type} className={`rounded-xl ${c.card} p-2.5`}>
                      <p className={`text-[10px] font-semibold ${c.label} mb-0.5`}>{type}</p>
                      <p className={`text-[12px] font-bold ${c.amt} tabular-nums leading-tight`}>
                        {Math.round(val).toLocaleString('ko-KR')}원
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* 순현금흐름 */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-[12px] font-semibold text-slate-500">순현금흐름</span>
                <span className={`text-[18px] font-extrabold tabular-nums ${netColor}`}>
                  {netSign}{Math.abs(summary.net).toLocaleString('ko-KR')}원
                </span>
              </div>
            </div>

            {/* ── 카테고리 분석 ── */}
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
              {/* 고정비 / 변동지출 탭 */}
              <div className="flex border-b border-slate-100">
                {['고정비', '변동지출'].map((t) => (
                  <button key={t} onClick={() => setCatTab(t)}
                    className={`flex-1 py-2.5 text-[12px] font-bold transition-colors ${
                      catTab === t ? 'text-slate-800 border-b-2 border-slate-700' : 'text-slate-400'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>

              {catBreakdown.length === 0 ? (
                <p className="text-center text-[12px] text-slate-400 py-5">{catTab} 내역 없음</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {catBreakdown.map(({ cat, amt, pct }) => {
                    const c = TYPE_COLOR[catTab]
                    return (
                      <div key={cat} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base leading-none">{icon(cat)}</span>
                            <span className="text-[13px] font-semibold text-slate-700">{cat}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-[13px] font-bold tabular-nums ${c.amt}`}>
                              {Math.round(amt).toLocaleString('ko-KR')}원
                            </span>
                            <span className="text-[11px] text-slate-400 ml-1.5 tabular-nums">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${c.bar} rounded-full transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── 내역 리스트 ── */}
            <div className="space-y-4">
              {grouped.map(([date, items]) => (
                <section key={date}>
                  <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                    {date.replace(/-/g, '.')}
                  </h2>
                  <div className="rounded-2xl bg-white shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                    {items.map((cf) => (
                      <CfRow key={cf.id} cf={cf} onDelete={() => deleteCashFlow(cf.id)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

          </div>
        )}
      </div>

      {/* ── 플로팅 버튼 ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setModalOpen(true)}
        aria-label="내역 추가"
        className="absolute bottom-4 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-300 flex items-center justify-center text-3xl font-light active:scale-95 transition-transform z-30 leading-none"
      >+</button>

      {/* ── 바텀 시트 ─────────────────────────────────────────────────── */}
      {modalOpen && (
        <AddModal
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
