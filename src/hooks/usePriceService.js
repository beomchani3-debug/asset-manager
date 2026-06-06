import { useState, useCallback } from 'react'
import { fetchPrice, fetchAllPrices } from '../services/priceService'
import { fetchFxRates } from '../services/fxService'
import useTransactionStore from '../store/useTransactionStore'
import usePriceStore from '../store/usePriceStore'
import useToastStore from '../store/useToastStore'

/**
 * 현재가·환율 새로고침을 제어하는 훅.
 *
 * 설계 원칙
 *  - 자동 polling 없음: 대시보드 새로고침 버튼 클릭 시에만 호출
 *  - refreshAll: 환율 → 현재가 순서 (원화 환산 정확도 보장)
 *  - 실패한 항목은 기존 저장값 유지 (서비스 레이어에서 처리)
 *  - 완료/실패 결과를 Toast로 알림
 */
export function usePriceService() {
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  const holdings = useTransactionStore((s) => s.holdings)

  const refreshFxRates = useCallback(async () => {
    return fetchFxRates()
  }, [])

  const refreshAllPrices = useCallback(async () => {
    setIsLoading(true)
    try {
      await fetchAllPrices(holdings)
      setLastUpdatedAt(new Date())
    } finally {
      setIsLoading(false)
    }
  }, [holdings])

  const refreshAll = useCallback(async () => {
    setIsLoading(true)
    try {
      await fetchFxRates()
      await fetchAllPrices(holdings)
      setLastUpdatedAt(new Date())

      // 가격 조회 결과 확인 → 토스트
      const prices = usePriceStore.getState().prices
      const active = holdings.filter((h) => h.quantity > 0)
      if (active.length === 0) return

      const missing = active.filter((h) => !prices[h.ticker])
      if (missing.length > 0) {
        useToastStore.getState().push(
          `${missing.length}개 종목 가격 조회 실패`,
          'warning'
        )
      } else {
        useToastStore.getState().push('현재가 업데이트 완료', 'success')
      }
    } catch {
      useToastStore.getState().push('현재가 조회에 실패했습니다', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [holdings])

  const refreshSinglePrice = useCallback(
    (ticker, market) => fetchPrice(ticker, market),
    []
  )

  return {
    refreshAll,
    refreshAllPrices,
    refreshFxRates,
    refreshSinglePrice,
    isLoading,
    lastUpdatedAt,
  }
}
