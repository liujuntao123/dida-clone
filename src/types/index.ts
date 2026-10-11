export type Priority = 0 | 1 | 2 | 3 // 0=无 1=低 2=中 3=高
export type TaskStatus = 'todo' | 'done' | 'abandoned' | 'trashed'
export type ViewMode = 'list' | 'board' | 'calendar' | 'quadrant'
export type SortBy = 'due' | 'priority' | 'created' | 'custom'
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
  /** 云同步用：该实体最后一次修改的逻辑时间（墓碑实体仅含 id/updatedAt/deleted） */
  updatedAt?: string
  deleted?: boolean
}

export interface Tag {
  id: string
  name: string
  color: string
  updatedAt?: string
  deleted?: boolean
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

export type ModuleId =
  | 'calendar'
  | 'quadrant'
  | 'settings'
  | 'search'
  | 'lists'
  | 'tags'
  | 'filters'

export type ActiveView =
  | { kind: 'smart'; id: SmartListId }
  | { kind: 'list'; id: string }
  | { kind: 'tag'; id: string }
  | { kind: 'module'; id: ModuleId }

export interface FilterState {
  priorities: Priority[]
  listIds: string[]
  tagIds: string[]
  query: string
}
