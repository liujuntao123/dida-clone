import type { Priority } from '../types'

export const LIST_COLORS = [
  '#FF7A45', // orange accent
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
] as const

export const TAG_COLORS = LIST_COLORS

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: '无',
  1: '低',
  2: '中',
  3: '高',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  0: '#9ca3af',
  1: '#3b82f6',
  2: '#f59e0b',
  3: '#ef4444',
}

export const INBOX_ID = 'list-inbox'

/** Primary accent — matches TickTick-like orange */
export const ACCENT = '#FF7A45'
export const ACCENT_SOFT = '#F18F53'
export const CARD_BG = '#1C1C1E'
