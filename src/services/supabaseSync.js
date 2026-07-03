/**
 * Supabase CRUD 함수 모음
 * 환경변수가 없으면 모든 함수는 즉시 반환 (no-op)
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import useAuthStore from '../store/useAuthStore'

function getUserId() {
  const user = useAuthStore.getState().user
  if (!user) throw new Error('로그인이 필요합니다')
  return user.id
}

// ─── Transactions: 거래기록 ───────────────────────────────────────────────────

function txToRow(tx, userId) {
  return {
    id:          tx.id,
    user_id:     userId,
    date:        tx.date,
    side:        tx.side,
    broker:      tx.broker      ?? '',
    asset_name:  tx.assetName   ?? '',
    ticker:      tx.ticker      ?? '',
    market:      tx.market      ?? '',
    sector:      tx.sector      ?? '',
    currency:    tx.currency    ?? 'KRW',
    price:       Number(tx.price)     || 0,
    quantity:    Number(tx.quantity)  || 0,
    fx_rate:     Number(tx.fxRate)    || 1,
    krw_amount:  Number(tx.krwAmount) || 0,
    memo:        tx.memo        ?? '',
    updated_at:  new Date().toISOString(),
  }
}

function rowToTx(row) {
  return {
    id:        row.id,
    date:      row.date,
    side:      row.side,
    broker:    row.broker,
    assetName: row.asset_name,
    ticker:    row.ticker,
    market:    row.market,
    sector:    row.sector,
    currency:  row.currency,
    price:     Number(row.price),
    quantity:  Number(row.quantity),
    fxRate:    Number(row.fx_rate),
    krwAmount: Number(row.krw_amount),
    memo:      row.memo,
  }
}

export async function fetchTransactions() {
  if (!isSupabaseConfigured) return null
  const userId = getUserId()
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(rowToTx)
}

export async function insertTransaction(tx) {
  if (!isSupabaseConfigured) return
  const userId = getUserId()
  const { error } = await supabase.from('transactions').insert(txToRow(tx, userId))
  if (error) throw error
}

export async function updateTransactionRow(id, tx) {
  if (!isSupabaseConfigured) return
  const userId = getUserId()
  const { error } = await supabase
    .from('transactions')
    .update(txToRow({ ...tx, id }, userId))
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteTransactionRow(id) {
  if (!isSupabaseConfigured) return
  const userId = getUserId()
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function upsertAllTransactions(transactions) {
  if (!isSupabaseConfigured || !transactions.length) return
  const userId = getUserId()
  const rows = transactions.map((tx) => txToRow(tx, userId))
  const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

export async function clearTransactions() {
  if (!isSupabaseConfigured) return
  const userId = getUserId()
  const { error } = await supabase.from('transactions').delete().eq('user_id', userId)
  if (error) throw error
}

// ─── CashFlows: 가계부 ────────────────────────────────────────────────────────

function cfToRow(cf, userId) {
  return {
    id:           cf.id,
    user_id:      userId,
    date:         cf.date,
    type:         cf.type,
    category:     cf.category,
    amount:       Number(cf.amount) || 0,
    memo:         cf.memo ?? '',
    recurring_id: cf.recurringId ?? null,
    updated_at:   new Date().toISOString(),
  }
}

function rowToCf(row) {
  return {
    id:          row.id,
    date:        row.date,
    type:        row.type,
    category:    row.category,
    amount:      Number(row.amount),
    memo:        row.memo,
    ...(row.recurring_id ? { recurringId: row.recurring_id } : {}),
  }
}

export async function fetchCashFlows() {
  if (!isSupabaseConfigured) return null
  const userId = getUserId()
  const { data, error } = await supabase
    .from('cash_flows')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(rowToCf)
}

export async function insertCashFlow(cf) {
  if (!isSupabaseConfigured) return
  const userId = getUserId()
  const { error } = await supabase.from('cash_flows').insert(cfToRow(cf, userId))
  if (error) throw error
}

export async function updateCashFlowRow(id, cf) {
  if (!isSupabaseConfigured) return
  const userId = getUserId()
  const { error } = await supabase
    .from('cash_flows')
    .update(cfToRow({ ...cf, id }, userId))
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteCashFlowRow(id) {
  if (!isSupabaseConfigured) return
  const userId = getUserId()
  const { error } = await supabase
    .from('cash_flows')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function upsertAllCashFlows(cashFlows) {
  if (!isSupabaseConfigured || !cashFlows.length) return
  const userId = getUserId()
  const rows = cashFlows.map((cf) => cfToRow(cf, userId))
  const { error } = await supabase.from('cash_flows').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

export async function clearCashFlows() {
  if (!isSupabaseConfigured) return
  const userId = getUserId()
  const { error } = await supabase.from('cash_flows').delete().eq('user_id', userId)
  if (error) throw error
}

// ─── Settings: 앱 설정 ────────────────────────────────────────────────────────

export async function fetchSettings() {
  if (!isSupabaseConfigured) return null
  const userId = getUserId()
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'main')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

export async function upsertSettings(settings) {
  if (!isSupabaseConfigured) return
  const userId = getUserId()
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key: 'main', user_id: userId, value: settings, updated_at: new Date().toISOString() },
      { onConflict: 'key,user_id' }
    )
  if (error) throw error
}

export async function clearSettings() {
  if (!isSupabaseConfigured) return
  const userId = getUserId()
  const { error } = await supabase
    .from('app_settings')
    .delete()
    .eq('key', 'main')
    .eq('user_id', userId)
  if (error) throw error
}
