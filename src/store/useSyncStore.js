import { create } from 'zustand'
import { isSupabaseConfigured } from '../lib/supabase'

const useSyncStore = create((set) => ({
  isConfigured: isSupabaseConfigured,
  isSyncing:    false,
  lastSyncAt:   null,   // Date | null
  syncError:    null,   // string | null

  setIsSyncing:  (v) => set({ isSyncing: v }),
  setLastSyncAt: (v) => set({ lastSyncAt: v }),
  setSyncError:  (v) => set({ syncError: v }),
  clearError:    ()  => set({ syncError: null }),
}))

export default useSyncStore
