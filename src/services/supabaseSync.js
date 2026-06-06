/**
 * Supabase CRUD 함수 모음
 * 환경변수가 없으면 모든 함수는 즉시 반환 (no-op)
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// ─── Transactions: 거래기록 ───────────────────────────────────────────────────

function txToRow(tx) {
  return {
    id:          tx.id,
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
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(rowToTx)
}

export async function insertTransaction(tx) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('transactions').insert(txToRow(tx))
  if (error) throw error
}

export async function updateTransactionRow(id, tx) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('transactions')
    .update(txToRow({ ...tx, id }))
    .eq('id', id)
  if (error) throw error
}

export async function deleteTransactionRow(id) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function upsertAllTransactions(transactions) {
  if (!isSupabaseConfigured || !transactions.length) return
  const rows = transactions.map(txToRow)
  const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

export async function clearTransactions() {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('transactions').delete().not('id', 'is', null)
  if (error) throw error
}

// ─── CashFlows: 가계부 ────────────────────────────────────────────────────────

function cfToRow(cf) {
  return {
    id:         cf.id,
    date:       cf.date,
    type:       cf.type,
    category:   cf.category,
    amount:     Number(cf.amount) || 0,
    memo:       cf.memo ?? '',
    updated_at: new Date().toISOString(),
  }
}

function rowToCf(row) {
  return {
    id:       row.id,
    date:     row.date,
    type:     row.type,
    category: row.category,
    amount:   Number(row.amount),
    memo:     row.memo,
  }
}

export async function fetchCashFlows() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('cash_flows')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(rowToCf)
}

export async function insertCashFlow(cf) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('cash_flows').insert(cfToRow(cf))
  if (error) throw error
}

export async function updateCashFlowRow(id, cf) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('cash_flows')
    .update(cfToRow({ ...cf, id }))
    .eq('id', id)
  if (error) throw error
}

export async function deleteCashFlowRow(id) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('cash_flows').delete().eq('id', id)
  if (error) throw error
}

export async function upsertAllCashFlows(cashFlows) {
  if (!isSupabaseConfigured || !cashFlows.length) return
  const rows = cashFlows.map(cfToRow)
  const { error } = await supabase.from('cash_flows').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

export async function clearCashFlows() {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('cash_flows').delete().not('id', 'is', null)
  if (error) throw error
}

// ─── Settings: 앱 설정 ────────────────────────────────────────────────────────

export async function fetchSettings() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'main')
    .maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

export async function upsertSettings(settings) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'main', value: settings, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export async function clearSettings() {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('app_settings').delete().eq('key', 'main')
  if (error) throw error
}
