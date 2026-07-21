import { create } from 'zustand'

interface AuthState {
  isAuthenticated: boolean
  hydrated:        boolean   // true once the persisted session has been read
  hydrate:         () => Promise<void>
  login:           () => void
  logout:          () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  hydrated:        false,

  // Read the persisted session from the main process (survives app restart)
  hydrate: async () => {
    try {
      const { authenticated } = await window.api.auth.getSession()
      set({ isAuthenticated: authenticated, hydrated: true })
    } catch {
      set({ hydrated: true })
    }
  },

  login:  () => set({ isAuthenticated: true }),

  logout: () => {
    window.api.auth.logout().catch(() => {})
    set({ isAuthenticated: false })
  },
}))
