import { useEffect } from 'react'
import { loadFromCloud } from '../services/cloudSync'
import { isSupabaseConfigured } from '../lib/supabase'
import useAuthStore from '../store/useAuthStore'

/**
 * 앱 최상위에서 한 번만 마운트해 사용한다.
 * - 로그인 시 Supabase에서 데이터를 불러온다
 * - 탭/화면이 다시 포커스될 때 자동으로 재동기화한다
 */
export function useDataSync() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    loadFromCloud().catch(console.error)
  }, [user])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        const currentUser = useAuthStore.getState().user
        if (currentUser) loadFromCloud().catch(console.error)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])
}
