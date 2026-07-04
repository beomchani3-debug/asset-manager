import { supabase, isSupabaseConfigured } from '../lib/supabase'
import useAuthStore from '../store/useAuthStore'

const NOT_CONFIGURED_MESSAGE =
  'Supabase가 설정되지 않았습니다. .env의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 확인하세요.'
const LOGIN_REQUIRED_MESSAGE = '로그인이 필요합니다.'

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured || !supabase) throw new Error(NOT_CONFIGURED_MESSAGE)
}

function getUserId() {
  const user = useAuthStore.getState().user
  if (!user?.id) throw new Error(LOGIN_REQUIRED_MESSAGE)
  return user.id
}

function userScope(userId) {
  return `user_id.eq.${userId},user_id.is.null`
}

function txToRow(tx, userId) {
  return {
    id: tx.id,
    user_id: userId,
    date: tx.date,
    side: tx.side,
    broker: tx.broker ?? '',
    asset_name: tx.assetName ?? '',
    ticker: tx.ticker ?? '',
    market: tx.market ?? '',
    sector: tx.sector ?? '',
    currency: tx.currency ?? 'KRW',
    price: Number(tx.price) || 0,
    quantity: Number(tx.quantity) || 0,
    fx_rate: Number(tx.fxRate) || 1,
    krw_amount: Number(tx.krwAmount) || 0,
    memo: tx.memo ?? '',
    updated_at: new Date().toISOString(),
  }
}

function rowToTx(row) {
  return {
    id: row.id,
    date: row.date,
    side: row.side,
    broker: row.broker,
    assetName: row.asset_name,
    ticker: row.ticker,
    market: row.market,
    sector: row.sector,
    currency: row.currency,
    price: Number(row.price),
    quantity: Number(row.quantity),
    fxRate: Number(row.fx_rate),
    krwAmount: Number(row.krw_amount),
    memo: row.memo,
    cloudUpdatedAt: row.updated_at,
    legacyNullUserId: row.user_id === null,
  }
}

export async function fetchTransactions() {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .or(userScope(userId))
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(rowToTx)
}

export async function insertTransaction(tx) {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { error } = await supabase
    .from('transactions')
    .upsert(txToRow(tx, userId), { onConflict: 'id' })
  if (error) throw error
}

export async function updateTransactionRow(id, tx) {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { error } = await supabase
    .from('transactions')
    .update(txToRow({ ...tx, id }, userId))
    .eq('id', id)
    .or(userScope(userId))
  if (error) throw error
}

export async function deleteTransactionRow(id) {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .or(userScope(userId))
  if (error) throw error
}

export async function upsertAllTransactions(transactions) {
  assertSupabaseConfigured()
  if (!transactions.length) return
  const userId = getUserId()
  const rows = transactions.map((tx) => txToRow(tx, userId))
  const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

export async function clearTransactions() {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { error } = await supabase.from('transactions').delete().eq('user_id', userId)
  if (error) throw error
}

function cfToRow(cf, userId) {
  return {
    id: cf.id,
    user_id: userId,
    date: cf.date,
    type: cf.type,
    category: cf.category,
    amount: Number(cf.amount) || 0,
    memo: cf.memo ?? '',
    recurring_id: cf.recurringId ?? null,
    updated_at: new Date().toISOString(),
  }
}

function rowToCf(row) {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    category: row.category,
    amount: Number(row.amount),
    memo: row.memo,
    ...(row.recurring_id ? { recurringId: row.recurring_id } : {}),
    cloudUpdatedAt: row.updated_at,
    legacyNullUserId: row.user_id === null,
  }
}

export async function fetchCashFlows() {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { data, error } = await supabase
    .from('cash_flows')
    .select('*')
    .or(userScope(userId))
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(rowToCf)
}

export async function insertCashFlow(cf) {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { error } = await supabase
    .from('cash_flows')
    .upsert(cfToRow(cf, userId), { onConflict: 'id' })
  if (error) throw error
}

export async function updateCashFlowRow(id, cf) {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { error } = await supabase
    .from('cash_flows')
    .update(cfToRow({ ...cf, id }, userId))
    .eq('id', id)
    .or(userScope(userId))
  if (error) throw error
}

export async function deleteCashFlowRow(id) {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { error } = await supabase
    .from('cash_flows')
    .delete()
    .eq('id', id)
    .or(userScope(userId))
  if (error) throw error
}

export async function upsertAllCashFlows(cashFlows) {
  assertSupabaseConfigured()
  if (!cashFlows.length) return
  const userId = getUserId()
  const rows = cashFlows.map((cf) => cfToRow(cf, userId))
  const { error } = await supabase.from('cash_flows').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

export async function clearCashFlows() {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { error } = await supabase.from('cash_flows').delete().eq('user_id', userId)
  if (error) throw error
}

export async function fetchSettings() {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { data, error } = await supabase
    .from('app_settings')
    .select('id,value,user_id,updated_at')
    .eq('key', 'main')
    .or(userScope(userId))
    .order('user_id', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0]?.value ?? null
}

export async function upsertSettings(settings) {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { data, error: selectError } = await supabase
    .from('app_settings')
    .select('id')
    .eq('key', 'main')
    .or(userScope(userId))
    .order('user_id', { ascending: false, nullsFirst: false })
    .limit(1)
  if (selectError) throw selectError

  const row = { key: 'main', user_id: userId, value: settings, updated_at: new Date().toISOString() }
  const query = data?.[0]?.id
    ? supabase.from('app_settings').update(row).eq('id', data[0].id)
    : supabase.from('app_settings').insert(row)
  const { error } = await query
  if (error) throw error
}

export async function clearSettings() {
  assertSupabaseConfigured()
  const userId = getUserId()
  const { error } = await supabase
    .from('app_settings')
    .delete()
    .eq('key', 'main')
    .eq('user_id', userId)
  if (error) throw error
}
