import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  insertTransaction,
  updateTransactionRow,
  deleteTransactionRow,
  clearTransactions,
} from '../services/supabaseSync'
import { isSupabaseConfigured } from '../lib/supabase'

function mergeById(localItems, cloudItems) {
  const merged = new Map()
  for (const item of localItems) merged.set(item.id, item)
  for (const item of cloudItems) merged.set(item.id, { ...merged.get(item.id), ...item })
  return [...merged.values()]
}

async function syncIfConfigured(action) {
  if (!isSupabaseConfigured) return
  await action()
}

/**
 * 거래 목록으로부터 보유종목을 계산한다.
 * 키: `${ticker}::${broker}` — 같은 종목도 증권사별로 분리 관리.
 *
 * avgPrice  = 매수 총금액(원통화) / 매수 총수량   → 원통화 기준 평균단가
 * avgFxRate = 매수 총krwAmount / 매수 총원통화금액 → 가중평균 환율
 * principal = quantity × avgPrice × avgFxRate   → 원화 환산 매입원금
 */
export function calcHoldings(transactions) {
  const map = {}

  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date))

  for (const tx of sorted) {
    if (tx.side === '배당') continue

    const key = `${tx.ticker}::${tx.broker}`
    if (!map[key]) {
      map[key] = {
        ticker: tx.ticker,
        assetName: tx.assetName,
        market: tx.market,
        sector: tx.sector,
        broker: tx.broker,
        currency: tx.currency,
        _buyQty: 0,
        _buyOrigAmt: 0,
        _buyKrw: 0,
        _sellQty: 0,
      }
    }

    const h = map[key]
    if (tx.side === '매수') {
      h._buyQty += tx.quantity
      h._buyOrigAmt += tx.price * tx.quantity
      h._buyKrw += tx.krwAmount
    } else if (tx.side === '매도') {
      h._sellQty += tx.quantity
    }
  }

  return Object.values(map)
    .map((h) => {
      const quantity = Math.max(0, h._buyQty - h._sellQty)
      const avgPrice = h._buyQty > 0 ? h._buyOrigAmt / h._buyQty : 0
      const avgFxRate = h._buyOrigAmt > 0 ? h._buyKrw / h._buyOrigAmt : 1
      const principal = quantity * avgPrice * avgFxRate
      return {
        ticker: h.ticker,
        assetName: h.assetName,
        market: h.market,
        sector: h.sector,
        broker: h.broker,
        currency: h.currency,
        quantity,
        avgPrice,
        avgFxRate,
        principal,
        currentPrice: null,
        marketValue: null,
        unrealizedPnl: null,
      }
    })
    .filter((h) => h.quantity > 0)
}

const useTransactionStore = create(
  persist(
    (set, get) => ({
      /** @type {import('../types').Transaction[]} */
      transactions: [],
      /** @type {import('../types').Holding[]} */
      holdings: [],

      addTransaction: async (tx) => {
        const newTx = { ...tx, id: crypto.randomUUID() }
        const prev = get().transactions
        const transactions = [...prev, newTx]
        set({ transactions, holdings: calcHoldings(transactions) })
        try {
          await syncIfConfigured(() => insertTransaction(newTx))
          return newTx
        } catch (err) {
          set({ transactions: prev, holdings: calcHoldings(prev) })
          throw err
        }
      },

      updateTransaction: async (id, updates) => {
        const prev = get().transactions
        const merged = { ...get().transactions.find(t => t.id === id), ...updates }
        const transactions = get().transactions.map((t) =>
          t.id === id ? merged : t
        )
        set({ transactions, holdings: calcHoldings(transactions) })
        try {
          await syncIfConfigured(() => updateTransactionRow(id, merged))
        } catch (err) {
          set({ transactions: prev, holdings: calcHoldings(prev) })
          throw err
        }
      },

      deleteTransaction: async (id) => {
        const prev = get().transactions
        const transactions = prev.filter((t) => t.id !== id)
        set({ transactions, holdings: calcHoldings(transactions) })
        try {
          await syncIfConfigured(() => deleteTransactionRow(id))
        } catch (err) {
          set({ transactions: prev, holdings: calcHoldings(prev) })
          throw err
        }
      },

      /** 전체 초기화 (설정 페이지 "데이터 삭제" 용) */
      clearAll: async () => {
        const prev = get().transactions
        set({ transactions: [], holdings: [] })
        try {
          await syncIfConfigured(() => clearTransactions())
        } catch (err) {
          set({ transactions: prev, holdings: calcHoldings(prev) })
          throw err
        }
      },

      /** Supabase에서 불러온 데이터로 스토어를 교체한다 */
      loadFromCloud: (transactions) => {
        if (!Array.isArray(transactions) || transactions.length === 0) return
        const merged = mergeById(get().transactions, transactions)
        set({ transactions: merged, holdings: calcHoldings(merged) })
      },
    }),
    { name: 'transactions-v2' }
  )
)

export default useTransactionStore
