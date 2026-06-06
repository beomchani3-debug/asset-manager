import { useEffect } from 'react'
import { loadFromCloud } from '../services/cloudSync'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * 앱 최상위에서 한 번만 마운트해 사용한다.
 * - 앱 시작 시 Supabase에서 데이터를 불러온다
 * - 탭/화면이 다시 포커스될 때 자동으로 재동기화한다 (크로스 디바이스 실시간 반영)
 */
export function useDataSync() {
  useEffect(() => {
    if (!isSupabaseConfigured) return
    loadFromCloud().catch(console.error)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        loadFromCloud().catch(console.error)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])
}
