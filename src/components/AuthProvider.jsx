import { useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import useAuthStore from '../store/useAuthStore'

export default function AuthProvider({ children }) {
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(null)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return children
}
