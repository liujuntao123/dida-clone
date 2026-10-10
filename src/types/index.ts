export type Priority = 0 | 1 | 2 | 3 // 0=无 1=低 2=中 3=高
export type TaskStatus = 'todo' | 'done' | 'abandoned' | 'trashed'
export type ViewMode = 'list' | 'board' | 'calendar' | 'quadrant'
export type SortBy = 'due' | 'priority' | 'created' | 'custom'
export type BoardGroupBy = 'priority' | 'status'
export type CalendarMode = 'month' | 'week'
export type ThemeMode = 'light' | 'dark'

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export type RepeatRule =
  | { type: 'daily' }
  | { type: 'weekly' }
  | { type: 'monthly' }
  | { type: 'custom'; intervalDays: number }

export interface Task {
  id: string
  title: string
  listId: string
  priority: Priority
  dueAt?: string | null
  remindAt?: string | null
  repeat?: RepeatRule | null
  tags: string[]
  parentId?: string | null
  checklist: ChecklistItem[]
  note?: string
  status: TaskStatus
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  order: number
  pinned?: boolean
}

export interface TaskList {
  id: string
  name: string
  color: string
  isInbox?: boolean
  order: number
}

export interface Tag {
  id: string
  name: string
  color: string
}

/** Kept for Cloudflare sync payload compatibility; frontend no longer uses sessions. */
export interface PomodoroSession {
  id: string
  taskId?: string | null
  startedAt: string
  durationSec: number
  completed: boolean
}

export type SmartListId =
  | 'inbox'
  | 'today'
  | 'tomorrow'
  | 'next7'
  | 'all'
  | 'completed'
  | 'abandoned'
  | 'trash'

export type ActiveView =
  | { kind: 'smart'; id: SmartListId }
  | { kind: 'list'; id: string }
  | { kind: 'tag'; id: string }
  | { kind: 'module'; id: 'calendar' | 'board' | 'quadrant' | 'habits' | 'settings' }

export interface FilterState {
  priorities: Priority[]
  listIds: string[]
  tagIds: string[]
  query: string
}
