import { useState, useRef } from 'react'
import useSettingsStore from '../store/useSettingsStore'
import useTransactionStore, { calcHoldings } from '../store/useTransactionStore'
import useCashFlowStore from '../store/useCashFlowStore'
import useToastStore from '../store/useToastStore'
import useSyncStore from '../store/useSyncStore'
import usePriceStore from '../store/usePriceStore'
import useAuthStore from '../store/useAuthStore'
import useFixedExpenseStore from '../store/useFixedExpenseStore'
import { migrateToCloud, loadFromCloud, clearAllCloudData } from '../services/cloudSync'
import { supabase } from '../lib/supabase'
import { T } from '../theme'

const APP_VERSION = '1.0.0'

// ─── 섹션 카드 ────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: T.textMuted }}>
        {title}
      </h2>
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}>
        {children}
      </div>
    </section>
  )
}

// ─── 설정 행 ──────────────────────────────────────────────────────────────────
function Row({ icon, label, value, color, onClick, chevron = false, danger = false }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center justify-between px-4 py-3.5 ${onClick ? 'active:opacity-70' : ''} transition-opacity`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg leading-none">{icon}</span>
        <span className="text-[13px] font-semibold" style={{ color: danger ? T.red : T.textPrimary }}>{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {value && <span className="text-[12px]" style={{ color: color ?? T.textMuted }}>{value}</span>}
        {chevron && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: T.textMuted }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </div>
    </button>
  )
}

// ─── 고정비 관리 ──────────────────────────────────────────────────────────────
function FixedExpenseSection() {
  const fixedExpenses    = useFixedExpenseStore((s) => s.fixedExpenses)
  const addFixedExpense  = useFixedExpenseStore((s) => s.addFixedExpense)
  const updateFixedExpense = useFixedExpenseStore((s) => s.updateFixedExpense)
  const deleteFixedExpense = useFixedExpenseStore((s) => s.deleteFixedExpense)
  const pushToast        = useToastStore((s) => s.push)

  const EMPTY_FORM = { name: '', amount: '', day: '' }
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const inpStyle = { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.textPrimary }
  const lblCls   = 'block text-[11px] font-semibold mb-1'

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(fe) {
    setEditId(fe.id)
    setForm({ name: fe.name, amount: String(fe.amount), day: String(fe.day) })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
  }

  function handleSave() {
    const name   = form.name.trim()
    const amount = parseInt(form.amount.replace(/,/g, ''), 10)
    const day    = parseInt(form.day, 10)
    if (!name)                        { pushToast('이름을 입력하세요', 'error'); return }
    if (!amount || amount <= 0)       { pushToast('금액을 입력하세요', 'error'); return }
    if (!day || day < 1 || day > 31) { pushToast('날짜는 1~31 사이로 입력하세요', 'error'); return }

    if (editId) {
      updateFixedExpense(editId, { name, amount, day })
      pushToast('수정되었습니다', 'success')
    } else {
      addFixedExpense({ name, amount, day, isActive: true })
      pushToast('고정비가 추가되었습니다', 'success')
    }
    closeForm()
  }

  function handleToggle(fe) {
    updateFixedExpense(fe.id, { isActive: !fe.isActive })
  }

  function handleDelete(id) {
    deleteFixedExpense(id)
    setConfirmDeleteId(null)
    pushToast('삭제되었습니다', 'success')
  }

  return (
    <Section title="고정비 관리">
      <div className="px-4 py-3 space-y-2">

        {/* 항목 목록 */}
        {fixedExpenses.length === 0 && !showForm && (
          <p className="text-[12px] text-center py-2" style={{ color: T.textMuted }}>
            등록된 고정비가 없습니다
          </p>
        )}

        {fixedExpenses.map((fe) => (
          <div key={fe.id}>
            {confirmDeleteId === fe.id ? (
              <div
                className="rounded-xl px-3 py-2.5 space-y-2"
                style={{ backgroundColor: 'rgba(224,82,82,0.08)', border: `1px solid ${T.red}` }}
              >
                <p className="text-[12px] font-semibold text-center" style={{ color: T.red }}>
                  "{fe.name}" 삭제하시겠습니까?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="flex-1 py-2 text-[12px] font-bold rounded-xl"
                    style={{ backgroundColor: T.inputBg, color: T.textPrimary }}
                  >취소</button>
                  <button
                    onClick={() => handleDelete(fe.id)}
                    className="flex-1 py-2 text-[12px] font-bold rounded-xl text-white"
                    style={{ backgroundColor: T.red }}
                  >삭제</button>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: T.inputBg, border: `1px solid ${T.inputBorder}` }}
              >
                {/* 토글 */}
                <button
                  onClick={() => handleToggle(fe)}
                  className="shrink-0 w-9 h-5 rounded-full relative transition-colors"
                  style={{ backgroundColor: fe.isActive ? T.gold : T.inputBorder }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                    style={{
                      backgroundColor: '#0A0A0A',
                      left: fe.isActive ? 'calc(100% - 1.1rem)' : '0.1rem',
                    }}
                  />
                </button>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <span
                    className="text-[13px] font-semibold truncate block"
                    style={{ color: fe.isActive ? T.textPrimary : T.textMuted }}
                  >
                    {fe.name}
                  </span>
                  <span className="text-[11px]" style={{ color: T.textMuted }}>
                    매달 {fe.day}일 · {fe.amount.toLocaleString('ko-KR')}원
                  </span>
                </div>

                {/* 수정/삭제 */}
                <button
                  onClick={() => openEdit(fe)}
                  className="shrink-0 text-[11px] px-2 py-1 rounded-lg"
                  style={{ color: T.gold, backgroundColor: 'rgba(201,168,76,0.1)' }}
                >수정</button>
                <button
                  onClick={() => setConfirmDeleteId(fe.id)}
                  className="shrink-0 text-[11px] px-2 py-1 rounded-lg"
                  style={{ color: T.red, backgroundColor: 'rgba(224,82,82,0.1)' }}
                >삭제</button>
              </div>
            )}
          </div>
        ))}

        {/* 추가/수정 폼 */}
        {showForm && (
          <div
            className="rounded-xl px-3 py-3 space-y-2.5 mt-1"
            style={{ backgroundColor: T.inputBg, border: `1px solid ${T.gold}` }}
          >
            <p className="text-[12px] font-bold" style={{ color: T.gold }}>
              {editId ? '고정비 수정' : '고정비 추가'}
            </p>
            <div>
              <label className={lblCls} style={{ color: T.textMuted }}>이름</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="유튜브 프리미엄"
                className="w-full border rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                style={inpStyle}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lblCls} style={{ color: T.textMuted }}>금액 (원)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="14900"
                  className="w-full border rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                  style={inpStyle}
                />
              </div>
              <div>
                <label className={lblCls} style={{ color: T.textMuted }}>매달 며칠</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.day}
                  onChange={(e) => setForm({ ...form, day: e.target.value })}
                  placeholder="23"
                  min="1"
                  max="31"
                  className="w-full border rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                  style={inpStyle}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-0.5">
              <button
                onClick={closeForm}
                className="flex-1 py-2 text-[12px] font-bold rounded-xl"
                style={{ backgroundColor: T.card, color: T.textMuted }}
              >취소</button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 text-[12px] font-bold rounded-xl"
                style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
              >저장</button>
            </div>
          </div>
        )}

        {/* 추가 버튼 */}
        {!showForm && (
          <button
            onClick={openAdd}
            className="w-full py-2.5 text-[13px] font-bold rounded-xl active:opacity-80 mt-1"
            style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: T.gold, border: `1px dashed ${T.goldDim}` }}
          >
            + 고정비 추가
          </button>
        )}
      </div>
    </Section>
  )
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export default function Settings() {
  const settings       = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const resetSettings  = useSettingsStore((s) => s.resetSettings)
  const pushToast      = useToastStore((s) => s.push)
  const fileInputRef   = useRef(null)
  const user           = useAuthStore((s) => s.user)

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const { isConfigured, isSyncing, lastSyncAt, syncError, clearError } = useSyncStore()
  const priceErrors = usePriceStore((s) => s.priceErrors)
  const [migrateLoading, setMigrateLoading] = useState(false)

  const [goalInput, setGoalInput] = useState(String(settings.dividendGoalKrw))

  function saveGoal() {
    const val = parseInt(goalInput.replace(/,/g, ''), 10)
    if (!val || val <= 0) { pushToast('올바른 금액을 입력하세요', 'error'); return }
    updateSettings({ dividendGoalKrw: val })
    pushToast('배당 목표가 저장되었습니다', 'success')
  }

  const [usdInput, setUsdInput] = useState(
    settings.fxRates.USD > 0 ? String(settings.fxRates.USD) : ''
  )
  const [jpyInput, setJpyInput] = useState(
    settings.fxRates.JPY > 0 ? String(settings.fxRates.JPY) : ''
  )

  function saveFxRates() {
    const usd = parseFloat(usdInput)
    const jpy = parseFloat(jpyInput)
    if (usd > 0) updateSettings({ fxRates: { ...settings.fxRates, USD: usd } })
    if (jpy > 0) updateSettings({ fxRates: { ...settings.fxRates, JPY: jpy } })
    if (usd > 0 || jpy > 0) {
      pushToast('환율이 저장되었습니다', 'success')
    } else {
      pushToast('올바른 환율을 입력하세요', 'error')
    }
  }

  const [confirmReset, setConfirmReset] = useState(false)

  function handleExport() {
    const data = {
      version:     APP_VERSION,
      exportedAt:  new Date().toISOString(),
      transactions: useTransactionStore.getState().transactions,
      cashFlows:   useCashFlowStore.getState().cashFlows,
      settings:    useSettingsStore.getState().settings,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const date = new Date().toLocaleDateString('sv')
    a.href     = url
    a.download = `asset-manager-${date}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    pushToast('백업 파일을 다운로드했습니다', 'success')
  }

  function handleImportFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!Array.isArray(data.transactions) || !Array.isArray(data.cashFlows)) {
          throw new Error('올바른 백업 파일이 아닙니다')
        }
        const holdings = calcHoldings(data.transactions)
        localStorage.setItem('transactions-v2', JSON.stringify({
          state: { transactions: data.transactions, holdings },
          version: 0,
        }))
        localStorage.setItem('cashflows-v1', JSON.stringify({
          state: { cashFlows: data.cashFlows },
          version: 0,
        }))
        if (data.settings) {
          localStorage.setItem('settings-v2', JSON.stringify({
            state: { settings: data.settings },
            version: 0,
          }))
        }
        pushToast('가져오기 완료. 앱을 재시작합니다', 'success')
        setTimeout(() => window.location.reload(), 1500)
      } catch (err) {
        pushToast(err.message ?? '가져오기에 실패했습니다', 'error')
      }
    }
    reader.readAsText(file)
    fileInputRef.current.value = ''
  }

  async function handleReset() {
    useTransactionStore.getState().clearAll()
    useCashFlowStore.getState().clearAll()
    resetSettings()
    setConfirmReset(false)
    await clearAllCloudData().catch(console.error)
    pushToast('전체 데이터가 초기화되었습니다', 'success')
  }

  async function handleMigrate() {
    setMigrateLoading(true)
    try {
      const result = await migrateToCloud()
      pushToast(`클라우드 업로드 완료 (거래 ${result.count.transactions}건, 가계부 ${result.count.cashFlows}건)`, 'success')
    } catch (err) {
      pushToast(err.message ?? '업로드 실패', 'error')
    } finally {
      setMigrateLoading(false)
    }
  }

  async function handleLoadCloud() {
    try {
      await loadFromCloud()
      pushToast('클라우드 데이터를 불러왔습니다', 'success')
    } catch (err) {
      pushToast(err.message ?? '불러오기 실패', 'error')
    }
  }

  const inpStyle = { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.textPrimary }
  const lblCls   = 'block text-[11px] font-semibold mb-1.5'

  const fxUpdated = settings.fxRatesUpdatedAt
    ? new Date(settings.fxRatesUpdatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="p-4 pb-10 space-y-4" style={{ backgroundColor: T.bg }}>

      {/* 계정 */}
      {user && (
        <Section title="계정">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-[12px]" style={{ color: T.textMuted }}>{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-[12px] font-semibold active:opacity-70"
              style={{ color: T.red }}
            >
              로그아웃
            </button>
          </div>
        </Section>
      )}

      {/* 고정비 관리 */}
      <FixedExpenseSection />

      {/* 목표 설정 */}
      <Section title="목표 설정">
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className={lblCls} style={{ color: T.textMuted }}>월 배당 목표금액</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                  style={inpStyle}
                  placeholder="10000000"
                />
              </div>
              <span className="flex items-center text-[13px] shrink-0" style={{ color: T.textMuted }}>원</span>
            </div>
            {(() => {
              const v = parseInt(goalInput) || 0
              return v > 0 ? (
                <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>
                  연 {Math.round(v * 12).toLocaleString('ko-KR')}원 · 일 {Math.round(v / 30).toLocaleString('ko-KR')}원
                </p>
              ) : null
            })()}
          </div>
          <button
            onClick={saveGoal}
            className="w-full py-2.5 text-[13px] font-bold rounded-xl active:opacity-80"
            style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
          >
            저장
          </button>
        </div>
      </Section>

      {/* 환율 설정 */}
      <Section title="환율 설정 (수동)">
        <div className="px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lblCls} style={{ color: T.textMuted }}>USD / KRW</label>
              <input
                type="number"
                inputMode="decimal"
                value={usdInput}
                onChange={(e) => setUsdInput(e.target.value)}
                placeholder="1380"
                className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                style={inpStyle}
              />
            </div>
            <div>
              <label className={lblCls} style={{ color: T.textMuted }}>JPY / KRW</label>
              <input
                type="number"
                inputMode="decimal"
                value={jpyInput}
                onChange={(e) => setJpyInput(e.target.value)}
                placeholder="9.5"
                className="w-full border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#C9A84C] transition-colors"
                style={inpStyle}
              />
            </div>
          </div>
          <button
            onClick={saveFxRates}
            className="w-full py-2.5 text-[13px] font-bold rounded-xl active:opacity-80"
            style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
          >
            저장
          </button>
          <p className="text-[11px] text-center" style={{ color: T.textMuted }}>
            현재가 새로고침 시 사용됩니다
            {fxUpdated && <span className="ml-1">· 최종 조회 {fxUpdated}</span>}
          </p>
        </div>
      </Section>

      {/* 데이터 관리 */}
      <Section title="데이터 관리">
        <Row icon="📤" label="백업 다운로드 (JSON)" chevron onClick={handleExport} />

        <div style={{ borderTop: `1px solid ${T.divider}` }}>
          <Row
            icon="📥"
            label="파일에서 복원 (JSON)"
            chevron
            onClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => handleImportFile(e.target.files[0])}
          />
        </div>

        <div style={{ borderTop: `1px solid ${T.divider}` }}>
          {confirmReset ? (
            <div className="px-4 py-3 space-y-2">
              <p className="text-[12px] font-semibold text-center" style={{ color: T.red }}>
                모든 거래기록·가계부·설정이 삭제됩니다. 계속하시겠습니까?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 py-2.5 text-[12px] font-bold rounded-xl active:opacity-80"
                  style={{ backgroundColor: T.inputBg, color: T.textPrimary }}
                >
                  취소
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 text-[12px] font-bold rounded-xl active:opacity-80 text-white"
                  style={{ backgroundColor: T.red }}
                >
                  전체 삭제 확인
                </button>
              </div>
            </div>
          ) : (
            <Row icon="🗑️" label="전체 데이터 초기화" danger onClick={() => setConfirmReset(true)} />
          )}
        </div>
      </Section>

      {/* 가격 조회 오류 */}
      {Object.keys(priceErrors).length > 0 && (
        <Section title="가격 조회 오류">
          <div className="px-4 py-4 space-y-2">
            {Object.entries(priceErrors).map(([ticker, reason]) => (
              <div
                key={ticker}
                className="flex items-start justify-between gap-2 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: `1px solid ${T.amber}` }}
              >
                <div className="min-w-0">
                  <span className="text-[12px] font-bold" style={{ color: T.amber }}>{ticker}</span>
                  <p className="text-[11px] break-all" style={{ color: T.amber }}>{reason}</p>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-center" style={{ color: T.textMuted }}>
              대시보드 새로고침 버튼으로 재시도하거나, 환율 설정에서 수동으로 입력하세요
            </p>
          </div>
        </Section>
      )}

      {/* 데이터 동기화 */}
      <Section title="데이터 동기화 (Supabase)">
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px]" style={{ color: T.textMuted }}>연결 상태</span>
            <span className="text-[12px] font-semibold" style={{ color: isConfigured ? T.green : T.textMuted }}>
              {isConfigured ? (isSyncing ? '동기화 중…' : '연결됨') : '미설정'}
            </span>
          </div>
          {lastSyncAt && (
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: T.textMuted }}>마지막 동기화</span>
              <span className="text-[12px]" style={{ color: T.textMuted }}>
                {lastSyncAt.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
          {syncError && (
            <div
              className="flex items-start justify-between gap-2 rounded-xl px-3 py-2.5"
              style={{ backgroundColor: 'rgba(224,82,82,0.08)', border: `1px solid ${T.red}` }}
            >
              <span className="text-[11px] flex-1" style={{ color: T.red }}>{syncError}</span>
              <button onClick={clearError} className="text-[11px] shrink-0" style={{ color: T.red }}>닫기</button>
            </div>
          )}
          {!isConfigured && (
            <p className="text-[11px] text-center" style={{ color: T.textMuted }}>
              .env에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 설정하면 활성화됩니다
            </p>
          )}
          {isConfigured && (
            <div className="space-y-2">
              <button
                onClick={handleMigrate}
                disabled={migrateLoading || isSyncing}
                className="w-full py-2.5 text-[13px] font-bold rounded-xl active:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
              >
                {migrateLoading ? '업로드 중…' : '로컬 → 클라우드 업로드'}
              </button>
              <button
                onClick={handleLoadCloud}
                disabled={isSyncing}
                className="w-full py-2.5 text-[13px] font-bold rounded-xl active:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: T.inputBg, color: T.textPrimary }}
              >
                클라우드에서 불러오기
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* 앱 정보 */}
      <Section title="앱 정보">
        <Row icon="ℹ️" label="버전" value={`v${APP_VERSION}`} />
        <div style={{ borderTop: `1px solid ${T.divider}` }}>
          <Row
            icon="🏠"
            label="홈 화면에 추가"
            value="설치하면 앱처럼 사용"
            chevron
            onClick={() => pushToast('브라우저 메뉴에서 "홈 화면에 추가"를 선택하세요', 'success')}
          />
        </div>
      </Section>

    </div>
  )
}
