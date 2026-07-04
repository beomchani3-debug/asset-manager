import { useState, useCallback } from 'react'
import { fetchPrice, fetchAllPrices } from '../services/priceService'
import { fetchFxRates } from '../services/fxService'
import useTransactionStore from '../store/useTransactionStore'
import usePriceStore from '../store/usePriceStore'
import useToastStore from '../store/useToastStore'
import { isMarketOpen } from '../utils/marketHours'

/**
 * 현재가·환율 새로고침을 제어하는 훅.
 *
 * 설계 원칙
 *  - 자동 polling 없음: 대시보드 새로고침 버튼 클릭 시에만 호출
 *  - refreshAll: 환율 → 현재가 순서 (원화 환산 정확도 보장)
 *  - 실패한 항목은 기존 저장값 유지 (서비스 레이어에서 처리)
 *  - 완료/실패 결과를 Toast로 알림, 실패 티커는 콘솔 + 스토어에 기록
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
      const { failed } = await fetchAllPrices(holdings)
      setLastUpdatedAt(new Date())

      // 실패 사유를 스토어에 저장 (Settings 등에서 확인 가능)
      if (failed.length > 0) {
        usePriceStore.getState().setPriceErrors(
          Object.fromEntries(failed.map(({ ticker, reason }) => [ticker, reason]))
        )
        console.warn('[usePriceService] 가격 조회 실패:', failed)

        // 장 마감(주말/시간외)이고 기존 가격이 남아있는 종목은 에러가 아니라
        // "마지막 가격 기준"으로 조용히 안내 - 실제 장애처럼 보여 불안하게 만들지 않도록
        const real = []
        const closed = []
        for (const f of failed) {
          const hasCached = usePriceStore.getState().getPrice(f.ticker) != null
          if (hasCached && !isMarketOpen(f.market)) closed.push(f)
          else real.push(f)
        }

        if (real.length > 0) {
          const names = real.map((f) => f.ticker).join(', ')
          useToastStore.getState().push(
            `가격 조회 실패 (${real.length}개): ${names}`,
            'warning'
          )
        } else if (closed.length > 0) {
          useToastStore.getState().push('장 마감 - 마지막 가격 기준', 'info')
        }
      } else {
        usePriceStore.getState().clearPriceErrors()
        useToastStore.getState().push('현재가 업데이트 완료', 'success')
      }
    } catch (err) {
      console.error('[usePriceService]', err)
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
