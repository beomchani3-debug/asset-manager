/**
 * 클라우드 ↔ 로컬 동기화 오케스트레이션
 * - loadFromCloud: Supabase → Zustand (컴포넌트 없이 호출 가능)
 * - migrateToCloud: Zustand(localStorage) → Supabase
 */
import {
  fetchTransactions, fetchCashFlows, fetchSettings,
  upsertAllTransactions, upsertAllCashFlows, upsertSettings,
  clearTransactions, clearCashFlows, clearSettings,
} from './supabaseSync'
import { isSupabaseConfigured } from '../lib/supabase'
import useSyncStore from '../store/useSyncStore'

// Lazy imports to avoid circular dependency issues at module load time
function getTxStore()  { return import('../store/useTransactionStore').then(m => m.default) }
function getCfStore()  { return import('../store/useCashFlowStore').then(m => m.default) }
function getSetStore() { return import('../store/useSettingsStore').then(m => m.default) }

let loadFromCloudPromise = null

/**
 * Supabase에서 데이터를 읽어 Zustand 스토어에 반영한다.
 * - 마이그레이션 전이고 클라우드가 비어있으면 로컬 데이터를 보존한다.
 */
export async function loadFromCloud() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되지 않았습니다. .env의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 확인하세요.')
  }
  if (loadFromCloudPromise) return loadFromCloudPromise

  loadFromCloudPromise = loadFromCloudInternal()
  try {
    return await loadFromCloudPromise
  } finally {
    loadFromCloudPromise = null
  }
}

async function loadFromCloudInternal() {
  const sync = useSyncStore.getState()
  sync.setIsSyncing(true)
  sync.setSyncError(null)

  try {
    const [transactions, cashFlows, settings] = await Promise.all([
      fetchTransactions(),
      fetchCashFlows(),
      fetchSettings(),
    ])

    const hasCloudData = (transactions?.length ?? 0) > 0 || (cashFlows?.length ?? 0) > 0
    const cloudSynced  = localStorage.getItem('cloud-synced') === 'true'

    // 아직 마이그레이션 전이고 클라우드가 비어있으면 로컬 데이터 그대로 유지
    if (!cloudSynced && !hasCloudData) {
      sync.setLastSyncAt(new Date())
      return { status: 'skipped' }
    }

    // 새 기기에서 클라우드 데이터가 있으면 자동으로 동기화된 것으로 표시
    if (!cloudSynced && hasCloudData) {
      localStorage.setItem('cloud-synced', 'true')
    }

    const [TxStore, CfStore, SetStore] = await Promise.all([
      getTxStore(), getCfStore(), getSetStore(),
    ])

    if (Array.isArray(transactions) && transactions.length > 0) TxStore.getState().loadFromCloud(transactions)
    if (Array.isArray(cashFlows) && cashFlows.length > 0) CfStore.getState().loadFromCloud(cashFlows)
    if (settings !== null) SetStore.getState().loadFromCloud(settings)

    sync.setLastSyncAt(new Date())
    return { status: 'synced' }
  } catch (err) {
    sync.setSyncError(err.message ?? '동기화 실패')
    throw err
  } finally {
    sync.setIsSyncing(false)
  }
}

/**
 * 로컬(localStorage) 데이터를 Supabase에 업로드한다 (최초 마이그레이션).
 * 기존 클라우드 데이터와 upsert(merge)하므로 중복 없이 안전하다.
 */
export async function migrateToCloud() {
  if (!isSupabaseConfigured) throw new Error('Supabase가 설정되지 않았습니다')

  const sync = useSyncStore.getState()
  sync.setIsSyncing(true)
  sync.setSyncError(null)

  try {
    const [TxStore, CfStore, SetStore] = await Promise.all([
      getTxStore(), getCfStore(), getSetStore(),
    ])

    const { transactions }  = TxStore.getState()
    const { cashFlows }     = CfStore.getState()
    const { settings }      = SetStore.getState()

    await Promise.all([
      upsertAllTransactions(transactions),
      upsertAllCashFlows(cashFlows),
      upsertSettings(settings),
    ])

    localStorage.setItem('cloud-synced', 'true')
    sync.setLastSyncAt(new Date())
    return { count: { transactions: transactions.length, cashFlows: cashFlows.length } }
  } catch (err) {
    sync.setSyncError(err.message ?? '마이그레이션 실패')
    throw err
  } finally {
    sync.setIsSyncing(false)
  }
}

/**
 * 클라우드의 모든 데이터를 삭제한다 (전체 초기화 시 호출).
 */
export async function clearAllCloudData() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되지 않았습니다. 클라우드 데이터 삭제를 건너뜁니다.')
  }
  await Promise.all([clearTransactions(), clearCashFlows(), clearSettings()])
  localStorage.removeItem('cloud-synced')
}
