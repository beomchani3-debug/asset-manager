import { useState, useMemo, useEffect, useRef } from 'react'
import useCashFlowStore from '../store/useCashFlowStore'
import useSettingsStore from '../store/useSettingsStore'
import { T } from '../theme'

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_TABS  = ['수입', '고정비', '변동지출']
const ADD_TYPES  = ['수입', '고정비', '변동지출', '용돈지출']

const DEFAULT_CATEGORIES = {
  수입:    ['월급', '배당금', '부동산', '사업', '기타'],
  고정비:  ['유튜브', '넷플릭스', 'OpenAI', '교회 헌금', '보험', '교통비', '유류비', '용돈', '지민이 용돈', '파킹통장', '생활체육센터', '기타'],
  변동지출:['꾸밈비', '식비', '외식비', '카드값', '생필품', '의료비', '경조사비', '환전', '기타'],
}

const CAT_ICON = {
  월급: '💼', 배당금: '📈', 부동산: '🏠', 사업: '🏢',
  유튜브: '▶️', 넷플릭스: '🎬', OpenAI: '🤖', '교회 헌금': '⛪', 보험: '🛡️',
  교통비: '🚇', 유류비: '⛽', '지민이 용돈': '👧', 파킹통장: '🅿️', 생활체육센터: '🏋️',
  꾸밈비: '💄', 용돈: '💵', 식비: '🍱', 외식비: '🍽️', 카드값: '💳',
  생필품: '🧴', 의료비: '🏥', 경조사비: '🎁', 환전: '💱',
  기타: '📌',
}
const catIcon = (cat) => CAT_ICON[cat] ?? '📌'

const STYLE = {
  수입:    { card: { backgroundColor: 'rgba(76,175,80,0.08)' },  label: { color: T.green }, amt: { color: T.green }, bar: { backgroundColor: T.green }, badge: { backgroundColor: 'rgba(76,175,80,0.12)', color: T.green }   },
  고정비:  { card: { backgroundColor: 'rgba(91,155,213,0.08)' }, label: { color: T.blue  }, amt: { color: T.blue  }, bar: { backgroundColor: T.blue  }, badge: { backgroundColor: 'rgba(91,155,213,0.12)', color: T.blue  }  },
  변동지출:{ card: { backgroundColor: 'rgba(224,82,82,0.08)' },  label: { color: T.red   }, amt: { color: T.red   }, bar: { backgroundColor: T.red   }, badge: { backgroundColor: 'rgba(224,82,82,0.12)', color: T.red   }  },
  용돈지출:{ card: { backgroundColor: 'rgba(201,168,76,0.08)' }, label: { color: T.gold  }, amt: { color: T.gold  }, bar: { backgroundColor: T.gold  }, badge: { backgroundColor: 'rgba(201,168,76,0.12)', color: T.gold  } },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtW = (n) => Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'

function todayIso() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}
function currentYM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function ymDisplay(ym) {
  const [y, m] = ym.split('-')
  return `${y}년 ${+m}월`
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function groupByDate(list) {
  const map = {}
  for (const c of list) (map[c.date] ??= []).push(c)
  return Object.entries(map).sort((a, b) => (b[0] > a[0] ? 1 : -1))
}

// ─── CfRow ────────────────────────────────────────────────────────────────────
function CfRow({ cf, onEdit, onDelete }) {
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

  const s    = STYLE[cf.type] ?? STYLE['수입']
  const sign = cf.type === '수입' ? '+' : '−'

  return (
    <div className="relative overflow-hidden select-none">
      <button
        className="absolute right-0 inset-y-0 w-[68px] flex flex-col items-center justify-center gap-0.5 active:opacity-80"
        style={{ backgroundColor: T.red }}
        onClick={(e) => { e.stopPropagation(); onDelete() }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
        </svg>
        <span className="text-[10px] font-bold text-white">삭제</span>
      </button>
      <div
        className={`relative transition-transform duration-200 ${revealed ? '-translate-x-[68px]' : 'translate-x-0'}`}
        style={{ backgroundColor: T.card }}
        onTouchStart={tStart} onTouchMove={tMove} onTouchEnd={tEnd} onClick={handleClick}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={s.card}>
            {catIcon(cf.category)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: T.textPrimary }}>{cf.category}</p>
            {cf.memo && <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: T.textMuted }}>{cf.memo}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[13px] font-bold tabular-nums" style={s.amt}>{sign}{fmtW(cf.amount)}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: T.textMuted }}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CategoryEditSheet ────────────────────────────────────────────────────────
function CategoryEditSheet({ current, onSave, onClose }) {
  const [visible,    setVisible]    = useState(false)
  const [activeType, setActiveType] = useState('수입')
  const [cats,       setCats]       = useState({ ...current })
  const [newCat,     setNewCat]     = useState('')
  const [editIdx,    setEditIdx]    = useState(null)
  const [editVal,    setEditVal]    = useState('')

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function close() { setVisible(false); setTimeout(onClose, 300) }
  function save()  { onSave(cats); close() }

  function addCat() {
    const t = newCat.trim()
    if (!t || cats[activeType].includes(t)) return
    const list = [...cats[activeType]]
    const ki = list.indexOf('기타')
    if (ki >= 0) list.splice(ki, 0, t)
    else list.push(t)
    setCats({ ...cats, [activeType]: list })
    setNewCat('')
  }

  function deleteCat(idx) {
    setCats({ ...cats, [activeType]: cats[activeType].filter((_, i) => i !== idx) })
    if (editIdx === idx) setEditIdx(null)
  }

  function startEdit(idx) { setEditIdx(idx); setEditVal(cats[activeType][idx]) }

  function confirmEdit() {
    const t = editVal.trim()
    if (t && t !== cats[activeType][editIdx]) {
      const list = [...cats[activeType]]
      list[editIdx] = t
      setCats({ ...cats, [activeType]: list })
    }
    setEditIdx(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={close}>
      <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`relative w-full max-w-[430px] rounded-t-3xl shadow-2xl transition-transform duration-300 flex flex-col max-h-[85vh] ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ backgroundColor: T.card, border: `1px solid ${T.gold}`, borderBottom: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: T.goldDim }} />
        </div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between shrink-0">
          <h3 className="text-[17px] font-bold" style={{ color: T.goldLight }}>카테고리 편집</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              className="px-4 py-1.5 text-[13px] font-bold rounded-xl active:opacity-80"
              style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
            >저장</button>
            <button
              onClick={close}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm active:opacity-70"
              style={{ backgroundColor: T.inputBg, color: T.textMuted }}
            >✕</button>
          </div>
        </div>
        <div className="flex border-b shrink-0 px-5 gap-4" style={{ borderColor: T.divider }}>
          {TYPE_TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setActiveType(t); setEditIdx(null); setNewCat('') }}
              className="pb-2.5 text-[13px] font-bold transition-colors"
              style={activeType === t
                ? { color: T.goldLight, borderBottom: `2px solid ${T.gold}` }
                : { color: T.textMuted }
              }
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-3 space-y-2">
          {cats[activeType].map((cat, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {editIdx === idx ? (
                <input
                  autoFocus value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onBlur={confirmEdit}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit() }}
                  className="flex-1 border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                  style={{ backgroundColor: T.inputBg, borderColor: T.gold, color: T.textPrimary }}
                />
              ) : (
                <button
                  onClick={() => cat !== '기타' && startEdit(idx)}
                  className="flex-1 text-left flex items-center gap-2.5 rounded-xl px-3 py-2.5 active:opacity-80"
                  style={{ backgroundColor: T.inputBg }}
                >
                  <span className="text-base leading-none">{catIcon(cat)}</span>
                  <span className="text-[13px] font-semibold" style={{ color: T.textPrimary }}>{cat}</span>
                  {cat !== '기타' && <span className="ml-auto text-[11px] shrink-0" style={{ color: T.textMuted }}>탭하여 수정</span>}
                </button>
              )}
              {cat !== '기타' && (
                <button
                  onClick={() => deleteCat(idx)}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:opacity-70 shrink-0"
                  style={{ backgroundColor: 'rgba(224,82,82,0.1)', color: T.red }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="shrink-0 px-5 py-3 flex gap-2" style={{ borderTop: `1px solid ${T.divider}` }}>
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCat() }}
            placeholder="새 카테고리 이름"
            className="flex-1 border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
            style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.textPrimary }}
          />
          <button
            onClick={addCat}
            disabled={!newCat.trim()}
            className="px-4 py-2.5 text-[13px] font-bold rounded-xl disabled:opacity-40 active:opacity-80 shrink-0"
            style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CfModal ──────────────────────────────────────────────────────────────────
function CfModal({ onClose, onSave, onDelete, categories, initialCf }) {
  const isEdit = !!initialCf

  const initType    = initialCf?.type ?? '수입'
  const initCatList = initType === '용돈지출'
    ? (categories['변동지출'] ?? [])
    : (categories[initType] ?? categories['수입'])
  const initInList  = initialCf ? initCatList.includes(initialCf.category) : true

  const [visible,    setVisible]    = useState(false)
  const [type,       setType]       = useState(initType)
  const [date,       setDate]       = useState(initialCf?.date ?? todayIso())
  const [category,   setCategory]   = useState(
    initialCf ? (initInList ? initialCf.category : '기타') : initCatList[0]
  )
  const [customCat,  setCustomCat]  = useState(
    initialCf && !initInList ? initialCf.category : ''
  )
  const [amount,     setAmount]     = useState(initialCf ? String(initialCf.amount) : '')
  const [memo,       setMemo]       = useState(initialCf?.memo ?? '')
  const [confirmDel, setConfirmDel] = useState(false)

  const isFirstMount = useRef(true)
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return }
    const catList = type === '용돈지출' ? categories['변동지출'] : (categories[type] ?? [])
    setCategory(catList[0] ?? '')
    setCustomCat('')
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function close() { setVisible(false); setTimeout(onClose, 300) }

  function handleSave() {
    const finalCat = category === '기타' && customCat.trim() ? customCat.trim() : category
    onSave({ date, type, category: finalCat, amount: parseFloat(amount) || 0, memo: memo.trim() })
    close()
  }

  const cats    = type === '용돈지출' ? categories['변동지출'] : (categories[type] ?? [])
  const s       = STYLE[type] ?? STYLE['수입']
  const canSave = !!date && parseFloat(amount) > 0 && (category !== '기타' || customCat.trim())

  const inpStyle = { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.textPrimary }

  const typeButtonColor = (t) => {
    if (t === '수입')    return T.green
    if (t === '고정비')  return T.blue
    if (t === '변동지출') return T.red
    return T.gold
  }

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
            <h3 className="text-[17px] font-bold" style={{ color: T.goldLight }}>
              {isEdit ? '내역 수정' : '내역 추가'}
            </h3>
            <button
              onClick={close}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm active:opacity-70"
              style={{ backgroundColor: T.inputBg, color: T.textMuted }}
            >✕</button>
          </div>

          {/* 유형 탭 */}
          <div className="space-y-2">
            <div className="flex gap-2">
              {['수입', '고정비', '변동지출'].map((t) => {
                const on = type === t
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-colors"
                    style={on
                      ? { backgroundColor: typeButtonColor(t), color: '#0A0A0A' }
                      : { backgroundColor: T.inputBg, color: T.textMuted }
                    }
                  >
                    {t}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setType('용돈지출')}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center justify-center gap-2"
              style={type === '용돈지출'
                ? { backgroundColor: T.gold, color: '#0A0A0A' }
                : { backgroundColor: T.inputBg, color: T.textMuted }
              }
            >
              <span>💵 용돈지출</span>
              <span className="text-[10px] font-normal" style={{ color: type === '용돈지출' ? '#0A0A0A' : T.textMuted }}>
                합계 미포함 · 용돈 예산에서 차감
              </span>
            </button>
          </div>

          {/* 날짜 + 금액 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1.5" style={{ color: T.textMuted }}>날짜</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                style={inpStyle} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1.5" style={{ color: T.textMuted }}>금액 (원)</label>
              <input type="number" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)} placeholder="0"
                className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                style={inpStyle} />
            </div>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: T.textMuted }}>카테고리</label>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors"
                  style={category === c
                    ? { ...s.badge, borderColor: 'transparent' }
                    : { backgroundColor: T.inputBg, color: T.textMuted, borderColor: T.inputBorder }
                  }
                >
                  <span>{catIcon(c)}</span>
                  <span>{c}</span>
                </button>
              ))}
            </div>
            {category === '기타' && (
              <input value={customCat} onChange={(e) => setCustomCat(e.target.value)}
                placeholder="카테고리 직접 입력"
                className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors mt-2"
                style={inpStyle} />
            )}
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: T.textMuted }}>메모 (선택)</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder=""
              className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
              style={inpStyle} />
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full py-3.5 text-[14px] font-bold rounded-2xl disabled:opacity-40 active:opacity-80 transition-opacity"
            style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
          >
            {isEdit ? '수정 완료' : '저장'}
          </button>

          {/* 삭제 버튼 (수정 모드) */}
          {isEdit && (
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
                  onClick={() => { onDelete(initialCf.id); close() }}
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
                내역 삭제
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CashFlow ─────────────────────────────────────────────────────────────────
export default function CashFlow() {
  const [ym,           setYm]           = useState(currentYM())
  const [catTab,       setCatTab]       = useState('고정비')
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editingCf,    setEditingCf]    = useState(null)
  const [editCatsOpen, setEditCatsOpen] = useState(false)

  const cashFlows        = useCashFlowStore((s) => s.cashFlows)
  const addCashFlow      = useCashFlowStore((s) => s.addCashFlow)
  const updateCashFlow   = useCashFlowStore((s) => s.updateCashFlow)
  const deleteCashFlow   = useCashFlowStore((s) => s.deleteCashFlow)
  const storedCats       = useSettingsStore((s) => s.settings.cashFlowCategories)
  const setCashFlowCats  = useSettingsStore((s) => s.setCashFlowCategories)

  const CATS = storedCats ?? DEFAULT_CATEGORIES

  const monthFlows = useMemo(
    () => cashFlows.filter((c) => c.date.startsWith(ym)),
    [cashFlows, ym]
  )
  const mainFlows = useMemo(
    () => monthFlows.filter((c) => c.type !== '용돈지출'),
    [monthFlows]
  )

  const summary = useMemo(() => {
    const income   = mainFlows.filter(c => c.type === '수입').reduce((s, c) => s + c.amount, 0)
    const fixed    = mainFlows.filter(c => c.type === '고정비').reduce((s, c) => s + c.amount, 0)
    const variable = mainFlows.filter(c => c.type === '변동지출').reduce((s, c) => s + c.amount, 0)
    return { income, fixed, variable, net: income - fixed - variable }
  }, [mainFlows])

  const pocketBudget = useMemo(
    () => mainFlows.filter(c => c.type === '고정비' && c.category === '용돈').reduce((s, c) => s + c.amount, 0),
    [mainFlows]
  )
  const pocketFlows = useMemo(() => monthFlows.filter(c => c.type === '용돈지출'), [monthFlows])
  const pocketSpent = useMemo(() => pocketFlows.reduce((s, c) => s + c.amount, 0), [pocketFlows])
  const pocketLeft  = pocketBudget - pocketSpent
  const hasPocket   = pocketBudget > 0 || pocketSpent > 0

  const catBreakdown = useMemo(() => {
    const rows  = mainFlows.filter(c => c.type === catTab)
    const total = rows.reduce((s, c) => s + c.amount, 0)
    const map   = {}
    for (const c of rows) map[c.category] = (map[c.category] ?? 0) + c.amount
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({ cat, amt, pct: total > 0 ? (amt / total) * 100 : 0 }))
  }, [mainFlows, catTab])

  const grouped = useMemo(
    () => groupByDate([...mainFlows].sort((a, b) => (b.date > a.date ? 1 : -1))),
    [mainFlows]
  )
  const pocketGrouped = useMemo(
    () => groupByDate([...pocketFlows].sort((a, b) => (b.date > a.date ? 1 : -1))),
    [pocketFlows]
  )

  function openAdd()     { setEditingCf(null); setModalOpen(true) }
  function openEdit(cf)  { setEditingCf(cf);   setModalOpen(true) }
  function closeModal()  { setModalOpen(false); setEditingCf(null) }

  function handleSave(data) {
    if (editingCf) updateCashFlow(editingCf.id, data)
    else           addCashFlow(data)
  }
  function handleDelete(id) {
    deleteCashFlow(id)
  }

  const netPos = summary.net >= 0

  return (
    <div className="relative flex flex-col h-full" style={{ backgroundColor: T.bg }}>

      {/* ── 월 네비게이션 */}
      <div
        className="shrink-0 border-b px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: T.card, borderColor: T.gold }}
      >
        <button
          onClick={() => setYm(shiftMonth(ym, -1))}
          className="w-8 h-8 rounded-full flex items-center justify-center active:opacity-70"
          style={{ backgroundColor: T.inputBg, color: T.textMuted }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-[15px] font-bold" style={{ color: T.goldLight }}>{ymDisplay(ym)}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYm(shiftMonth(ym, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center active:opacity-70"
            style={{ backgroundColor: T.inputBg, color: T.textMuted }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <button
            onClick={() => setEditCatsOpen(true)}
            title="카테고리 편집"
            className="w-8 h-8 rounded-full flex items-center justify-center active:opacity-70"
            style={{ backgroundColor: T.inputBg, color: T.textMuted }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {monthFlows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>📒</div>
            <p className="text-[15px] font-semibold" style={{ color: T.textPrimary }}>이번달 내역이 없어요</p>
            <p className="text-[13px]" style={{ color: T.textMuted }}>추가해보세요!</p>
          </div>
        ) : (
          <div className="p-4 pb-20 space-y-4">

            {/* ── 요약 카드 */}
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: '수입',    val: summary.income   },
                  { type: '고정비',  val: summary.fixed    },
                  { type: '변동지출',val: summary.variable },
                ].map(({ type: t, val }) => {
                  const st = STYLE[t]
                  return (
                    <div key={t} className="rounded-xl p-2.5" style={st.card}>
                      <p className="text-[10px] font-semibold mb-0.5" style={st.label}>{t}</p>
                      <p className="text-[12px] font-bold tabular-nums leading-tight" style={st.amt}>
                        {Math.round(val).toLocaleString('ko-KR')}원
                      </p>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between pt-1" style={{ borderTop: `1px solid ${T.divider}` }}>
                <span className="text-[12px] font-semibold" style={{ color: T.textMuted }}>순현금흐름</span>
                <span className="text-[20px] font-extrabold tabular-nums" style={{ color: netPos ? T.green : T.red }}>
                  {netPos ? '+' : '−'}{fmtW(summary.net)}
                </span>
              </div>
            </div>

            {/* ── 용돈 현황 카드 */}
            {hasPocket && (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>
                <div
                  className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ backgroundColor: 'rgba(201,168,76,0.06)', borderColor: T.goldDim }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">💵</span>
                    <span className="text-[14px] font-bold" style={{ color: T.goldLight }}>용돈 현황</span>
                    <span className="text-[11px]" style={{ color: T.textMuted }}>합계 미포함</span>
                  </div>
                  <span className="text-[13px] font-bold tabular-nums" style={{ color: pocketLeft >= 0 ? T.gold : T.red }}>
                    잔액 {pocketLeft >= 0 ? '+' : '−'}{Math.abs(Math.round(pocketLeft)).toLocaleString('ko-KR')}원
                  </span>
                </div>
                <div className="grid grid-cols-2" style={{ borderBottom: `1px solid ${T.divider}` }}>
                  <div className="px-4 py-3">
                    <p className="text-[11px] mb-0.5" style={{ color: T.textMuted }}>이번달 예산</p>
                    <p className="text-[15px] font-bold tabular-nums" style={{ color: T.textPrimary }}>
                      {pocketBudget > 0 ? fmtW(pocketBudget) : '미설정'}
                    </p>
                  </div>
                  <div className="px-4 py-3" style={{ borderLeft: `1px solid ${T.divider}` }}>
                    <p className="text-[11px] mb-0.5" style={{ color: T.textMuted }}>사용</p>
                    <p className="text-[15px] font-bold tabular-nums" style={{ color: T.gold }}>{fmtW(pocketSpent)}</p>
                  </div>
                </div>
                {pocketBudget > 0 && (
                  <div className="px-4 pb-3 pt-2">
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: T.divider }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (pocketSpent / pocketBudget) * 100)}%`,
                          backgroundColor: pocketLeft >= 0 ? T.gold : T.red,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-right mt-1 tabular-nums" style={{ color: T.textMuted }}>
                      {Math.round((pocketSpent / pocketBudget) * 100)}% 사용
                    </p>
                  </div>
                )}
                {pocketGrouped.length > 0 ? (
                  <div style={{ borderTop: `1px solid ${T.divider}` }}>
                    {pocketGrouped.map(([date, items]) => (
                      <div key={date}>
                        <p className="text-[10px] font-semibold px-4 pt-2.5 pb-1" style={{ color: T.textMuted }}>
                          {date.replace(/-/g, '.')}
                        </p>
                        {items.map((cf) => (
                          <CfRow key={cf.id} cf={cf}
                            onEdit={() => openEdit(cf)}
                            onDelete={() => deleteCashFlow(cf.id)} />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[12px] py-3" style={{ color: T.textMuted, borderTop: `1px solid ${T.divider}` }}>
                    용돈 내역을 추가해보세요
                  </p>
                )}
              </div>
            )}

            {/* ── 카테고리 분석 */}
            {mainFlows.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>
                <div className="flex" style={{ borderBottom: `1px solid ${T.divider}` }}>
                  {['고정비', '변동지출'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setCatTab(t)}
                      className="flex-1 py-2.5 text-[12px] font-bold transition-colors"
                      style={catTab === t
                        ? { color: T.goldLight, borderBottom: `2px solid ${T.gold}` }
                        : { color: T.textMuted }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {catBreakdown.length === 0 ? (
                  <p className="text-center text-[12px] py-5" style={{ color: T.textMuted }}>{catTab} 내역 없음</p>
                ) : (
                  <div>
                    {catBreakdown.map(({ cat, amt, pct }, i) => {
                      const st = STYLE[catTab]
                      return (
                        <div
                          key={cat}
                          className="px-4 py-3"
                          style={i > 0 ? { borderTop: `1px solid ${T.divider}` } : {}}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-base leading-none">{catIcon(cat)}</span>
                              <span className="text-[13px] font-semibold" style={{ color: T.textPrimary }}>{cat}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[13px] font-bold tabular-nums" style={st.amt}>
                                {Math.round(amt).toLocaleString('ko-KR')}원
                              </span>
                              <span className="text-[11px] ml-1.5 tabular-nums" style={{ color: T.textMuted }}>
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.divider }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, ...st.bar }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── 메인 내역 리스트 */}
            {grouped.length > 0 && (
              <div className="space-y-4">
                {grouped.map(([date, items]) => (
                  <section key={date}>
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: T.textMuted }}>
                      {date.replace(/-/g, '.')}
                    </h2>
                    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>
                      {items.map((cf, i) => (
                        <div key={cf.id} style={i > 0 ? { borderTop: `1px solid ${T.divider}` } : {}}>
                          <CfRow cf={cf}
                            onEdit={() => openEdit(cf)}
                            onDelete={() => deleteCashFlow(cf.id)} />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── 플로팅 버튼 */}
      <button
        onClick={openAdd}
        aria-label="내역 추가"
        className="absolute bottom-4 right-4 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-3xl font-light active:scale-95 transition-transform z-30 leading-none"
        style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
      >
        +
      </button>

      {modalOpen && (
        <CfModal
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
          categories={CATS}
          initialCf={editingCf}
        />
      )}
      {editCatsOpen && (
        <CategoryEditSheet current={CATS} onSave={(cats) => setCashFlowCats(cats)} onClose={() => setEditCatsOpen(false)} />
      )}
    </div>
  )
}
