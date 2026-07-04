import { useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import useAuthStore from '../store/useAuthStore'

export default function AuthProvider({ children }) {
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(null)
      return
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
      })
      .catch((err) => {
        console.error('[AuthProvider] getSession 실패:', err)
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return children
}
