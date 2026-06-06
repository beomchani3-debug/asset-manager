import { useState, useRef } from 'react'
import useSettingsStore from '../store/useSettingsStore'
import useTransactionStore, { calcHoldings } from '../store/useTransactionStore'
import useCashFlowStore from '../store/useCashFlowStore'
import useToastStore from '../store/useToastStore'
import useSyncStore from '../store/useSyncStore'
import { migrateToCloud, loadFromCloud, clearAllCloudData } from '../services/cloudSync'

const APP_VERSION = '1.0.0'

// ─── 섹션 카드 ────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
        {title}
      </h2>
      <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
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
      className={`w-full flex items-center justify-between px-4 py-3.5 ${onClick ? 'active:bg-slate-50' : ''} transition-colors`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg leading-none">{icon}</span>
        <span className={`text-[13px] font-semibold ${danger ? 'text-red-500' : 'text-slate-700'}`}>{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {value && <span className={`text-[12px] ${color ?? 'text-slate-400'}`}>{value}</span>}
        {chevron && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-slate-300">
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </div>
    </button>
  )
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export default function Settings() {
  const settings       = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const resetSettings  = useSettingsStore((s) => s.resetSettings)
  const pushToast      = useToastStore((s) => s.push)
  const fileInputRef   = useRef(null)

  const { isConfigured, isSyncing, lastSyncAt, syncError, clearError } = useSyncStore()
  const [migrateLoading, setMigrateLoading] = useState(false)

  // ① 목표 설정
  const [goalInput, setGoalInput] = useState(String(settings.dividendGoalKrw))

  function saveGoal() {
    const val = parseInt(goalInput.replace(/,/g, ''), 10)
    if (!val || val <= 0) { pushToast('올바른 금액을 입력하세요', 'error'); return }
    updateSettings({ dividendGoalKrw: val })
    pushToast('배당 목표가 저장되었습니다', 'success')
  }

  // ② 환율 설정
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

  // ③ 데이터 관리
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
        // Zustand persist 포맷으로 localStorage에 직접 기록 후 새로고침
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
    // input 초기화 (같은 파일 재선택 허용)
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

  const inpCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-blue-400 transition-colors'
  const lblCls = 'block text-[11px] font-semibold text-slate-500 mb-1.5'

  const fxUpdated = settings.fxRatesUpdatedAt
    ? new Date(settings.fxRatesUpdatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="p-4 pb-10 space-y-4">

      {/* ① 목표 설정 */}
      <Section title="목표 설정">
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className={lblCls}>월 배당 목표금액</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className={inpCls}
                  placeholder="10000000"
                />
              </div>
              <span className="flex items-center text-[13px] text-slate-500 shrink-0">원</span>
            </div>
            {(() => {
              const v = parseInt(goalInput) || 0
              return v > 0 ? (
                <p className="text-[11px] text-slate-400 mt-1">
                  연 {Math.round(v * 12).toLocaleString('ko-KR')}원 · 일 {Math.round(v / 30).toLocaleString('ko-KR')}원
                </p>
              ) : null
            })()}
          </div>
          <button
            onClick={saveGoal}
            className="w-full py-2.5 bg-blue-600 text-white text-[13px] font-bold rounded-xl active:opacity-80"
          >
            저장
          </button>
        </div>
      </Section>

      {/* ② 환율 설정 */}
      <Section title="환율 설정 (수동)">
        <div className="px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lblCls}>USD / KRW</label>
              <input
                type="number"
                inputMode="decimal"
                value={usdInput}
                onChange={(e) => setUsdInput(e.target.value)}
                placeholder="1380"
                className={inpCls}
              />
            </div>
            <div>
              <label className={lblCls}>JPY / KRW</label>
              <input
                type="number"
                inputMode="decimal"
                value={jpyInput}
                onChange={(e) => setJpyInput(e.target.value)}
                placeholder="9.5"
                className={inpCls}
              />
            </div>
          </div>
          <button
            onClick={saveFxRates}
            className="w-full py-2.5 bg-blue-600 text-white text-[13px] font-bold rounded-xl active:opacity-80"
          >
            저장
          </button>
          <p className="text-[11px] text-slate-400 text-center">
            현재가 새로고침 시 사용됩니다
            {fxUpdated && <span className="ml-1">· 최종 조회 {fxUpdated}</span>}
          </p>
        </div>
      </Section>

      {/* ③ 데이터 관리 */}
      <Section title="데이터 관리">
        {/* 내보내기 */}
        <Row
          icon="📤"
          label="백업 다운로드 (JSON)"
          chevron
          onClick={handleExport}
        />

        {/* 가져오기 */}
        <div className="border-t border-slate-50">
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

        {/* 초기화 */}
        <div className="border-t border-slate-50">
          {confirmReset ? (
            <div className="px-4 py-3 space-y-2">
              <p className="text-[12px] text-red-500 font-semibold text-center">
                모든 거래기록·가계부·설정이 삭제됩니다. 계속하시겠습니까?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-[12px] font-bold rounded-xl active:opacity-80"
                >
                  취소
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 bg-red-500 text-white text-[12px] font-bold rounded-xl active:opacity-80"
                >
                  전체 삭제 확인
                </button>
              </div>
            </div>
          ) : (
            <Row
              icon="🗑️"
              label="전체 데이터 초기화"
              danger
              onClick={() => setConfirmReset(true)}
            />
          )}
        </div>
      </Section>

      {/* ④ 데이터 동기화 */}
      <Section title="데이터 동기화 (Supabase)">
        <div className="px-4 py-4 space-y-3">
          {/* 연결 상태 */}
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-slate-500">연결 상태</span>
            <span className={`text-[12px] font-semibold ${isConfigured ? 'text-emerald-600' : 'text-slate-400'}`}>
              {isConfigured ? (isSyncing ? '동기화 중…' : '연결됨') : '미설정'}
            </span>
          </div>
          {lastSyncAt && (
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-slate-500">마지막 동기화</span>
              <span className="text-[12px] text-slate-400">
                {lastSyncAt.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
          {syncError && (
            <div className="flex items-start justify-between gap-2 bg-red-50 rounded-xl px-3 py-2.5">
              <span className="text-[11px] text-red-500 flex-1">{syncError}</span>
              <button onClick={clearError} className="text-[11px] text-red-400 shrink-0">닫기</button>
            </div>
          )}
          {!isConfigured && (
            <p className="text-[11px] text-slate-400 text-center">
              .env에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 설정하면 활성화됩니다
            </p>
          )}
          {isConfigured && (
            <div className="space-y-2">
              <button
                onClick={handleMigrate}
                disabled={migrateLoading || isSyncing}
                className="w-full py-2.5 bg-blue-600 text-white text-[13px] font-bold rounded-xl active:opacity-80 disabled:opacity-50"
              >
                {migrateLoading ? '업로드 중…' : '로컬 → 클라우드 업로드'}
              </button>
              <button
                onClick={handleLoadCloud}
                disabled={isSyncing}
                className="w-full py-2.5 bg-slate-100 text-slate-700 text-[13px] font-bold rounded-xl active:opacity-80 disabled:opacity-50"
              >
                클라우드에서 불러오기
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* ⑤ 앱 정보 */}
      <Section title="앱 정보">
        <Row icon="ℹ️" label="버전" value={`v${APP_VERSION}`} />
        <div className="border-t border-slate-50">
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
