import { create } from 'zustand'

export type SessionUser = {
  id: string
  email: string
  name: string
  role?: string | null
}

export type SessionPhase = 'loading' | 'anon' | 'authed'

interface SessionState {
  phase: SessionPhase
  user: SessionUser | null
  /** 需要展示在登录页的提示（如「登录已过期」） */
  notice: string | null
  setPhase: (p: SessionPhase) => void
  setUser: (u: SessionUser | null) => void
  setNotice: (n: string | null) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  phase: 'loading',
  user: null,
  notice: null,
  setPhase: (phase) => set({ phase }),
  setUser: (user) => set({ user, phase: user ? 'authed' : 'anon' }),
  setNotice: (notice) => set({ notice }),
}))
