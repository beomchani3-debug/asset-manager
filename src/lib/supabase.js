import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Supabase 환경변수가 설정되어 있는지 여부 */
export const isSupabaseConfigured = !!(url && key)

/** Supabase 클라이언트 (설정 안 된 경우 null) */
export const supabase = isSupabaseConfigured
  ? createClient(url, key)
  : null
