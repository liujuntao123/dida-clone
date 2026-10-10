import { create } from 'zustand'

interface ToastState {
  message: string | null
  undoLabel: string
  undo: (() => void) | null
  show: (message: string, opts?: { undo?: () => void; undoLabel?: string; durationMs?: number }) => void
  dismiss: () => void
}

let timer: ReturnType<typeof setTimeout> | null = null

export const useToastStore = create<ToastState>((set, get) => ({
  message: null,
  undoLabel: '撤销',
  undo: null,
  show: (message, opts = {}) => {
    if (timer) clearTimeout(timer)
    set({
      message,
      undo: opts.undo ?? null,
      undoLabel: opts.undoLabel ?? '撤销',
    })
    timer = setTimeout(() => get().dismiss(), opts.durationMs ?? 5000)
  },
  dismiss: () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    set({ message: null, undo: null })
  },
}))
