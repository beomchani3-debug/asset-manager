import { create } from 'zustand'

const useToastStore = create((set) => ({
  /** @type {{ id: string, message: string, type: 'success'|'error'|'warning' }[]} */
  toasts: [],

  push: (message, type = 'success') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => useToastStore.getState().dismiss(id), 3000)
  },

  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export default useToastStore
