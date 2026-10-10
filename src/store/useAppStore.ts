import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ActiveView,
  BoardGroupBy,
  CalendarMode,
  ChecklistItem,
  FilterState,
  PomodoroSession,
  Priority,
  RepeatRule,
  SortBy,
  Tag,
  Task,
  TaskList,
  TaskStatus,
  ThemeMode,
  ViewMode,
} from '../types'
import { INBOX_ID } from '../lib/constants'
import { uid } from '../lib/id'
import { dayjs, isToday, isTomorrow, isWithinNext7Days, nextRepeatDate, parseNaturalDate } from '../lib/dates'
import { seedLists, seedSessions, seedTags, seedTasks } from '../lib/seed'

interface AppState {
  lists: TaskList[]
  tags: Tag[]
  tasks: Task[]
  sessions: PomodoroSession[]
  theme: ThemeMode
  activeView: ActiveView
  selectedTaskId: string | null
  listViewMode: ViewMode
  sortBy: SortBy
  boardGroupBy: BoardGroupBy
  calendarMode: CalendarMode
  calendarCursor: string
  filter: FilterState
  sidebarOpen: boolean
  notifiedReminders: string[]

  setTheme: (t: ThemeMode) => void
  toggleTheme: () => void
  setActiveView: (v: ActiveView) => void
  setSelectedTaskId: (id: string | null) => void
  setListViewMode: (m: ViewMode) => void
  setSortBy: (s: SortBy) => void
  setBoardGroupBy: (g: BoardGroupBy) => void
  setCalendarMode: (m: CalendarMode) => void
  setCalendarCursor: (iso: string) => void
  setFilter: (f: Partial<FilterState>) => void
  setSidebarOpen: (open: boolean) => void

  addList: (name: string, color: string) => void
  updateList: (id: string, patch: Partial<TaskList>) => void
  deleteList: (id: string) => void

  addTag: (name: string, color: string) => Tag
  updateTag: (id: string, patch: Partial<Tag>) => void
  deleteTag: (id: string) => void

  quickAdd: (raw: string, overrides?: Partial<Task>) => Task
  addTask: (partial: Partial<Task> & { title: string }) => Task
  updateTask: (id: string, patch: Partial<Task>) => void
  toggleComplete: (id: string) => void
  softDelete: (id: string) => void
  restoreTask: (id: string) => void
  permanentlyDelete: (id: string) => void
  emptyTrash: () => void
  abandonTask: (id: string) => void
  setTaskPriority: (id: string, priority: Priority) => void
  moveTaskToList: (id: string, listId: string) => void
  reorderTasks: (orderedIds: string[]) => void
  addSubtask: (parentId: string, title: string) => Task
  setChecklist: (taskId: string, items: ChecklistItem[]) => void
  toggleChecklistItem: (taskId: string, itemId: string) => void

  addPomodoroSession: (s: Omit<PomodoroSession, 'id'> & { id?: string }) => void
  markReminderNotified: (taskId: string) => void

  getVisibleTasks: () => Task[]
  getTaskById: (id: string) => Task | undefined
  getSubtasks: (parentId: string) => Task[]
}

function nowIso() {
  return dayjs().toISOString()
}

function applyFilters(tasks: Task[], filter: FilterState): Task[] {
  return tasks.filter((t) => {
    if (filter.priorities.length && !filter.priorities.includes(t.priority)) return false
    if (filter.listIds.length && !filter.listIds.includes(t.listId)) return false
    if (filter.tagIds.length && !filter.tagIds.some((id) => t.tags.includes(id))) return false
    if (filter.query.trim()) {
      const q = filter.query.trim().toLowerCase()
      const hay = `${t.title}\n${t.note ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  const arr = [...tasks]
  switch (sortBy) {
    case 'priority':
      return arr.sort((a, b) => b.priority - a.priority || a.order - b.order)
    case 'due':
      return arr.sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return a.order - b.order
        if (!a.dueAt) return 1
        if (!b.dueAt) return -1
        return dayjs(a.dueAt).valueOf() - dayjs(b.dueAt).valueOf()
      })
    case 'created':
      return arr.sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
    default:
      return arr.sort((a, b) => a.order - b.order)
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      lists: seedLists,
      tags: seedTags,
      tasks: seedTasks,
      sessions: seedSessions,
      theme: 'light',
      activeView: { kind: 'smart', id: 'today' },
      selectedTaskId: null,
      listViewMode: 'list',
      sortBy: 'due',
      boardGroupBy: 'priority',
      calendarMode: 'month',
      calendarCursor: dayjs().toISOString(),
      filter: { priorities: [], listIds: [], tagIds: [], query: '' },
      sidebarOpen: false,
      notifiedReminders: [],

      setTheme: (t) => set({ theme: t }),
      toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
      setActiveView: (v) => set({ activeView: v, sidebarOpen: false }),
      setSelectedTaskId: (id) => set({ selectedTaskId: id }),
      setListViewMode: (m) => set({ listViewMode: m }),
      setSortBy: (s) => set({ sortBy: s }),
      setBoardGroupBy: (g) => set({ boardGroupBy: g }),
      setCalendarMode: (m) => set({ calendarMode: m }),
      setCalendarCursor: (iso) => set({ calendarCursor: iso }),
      setFilter: (f) => set({ filter: { ...get().filter, ...f } }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      addList: (name, color) =>
        set({
          lists: [
            ...get().lists,
            { id: uid('list'), name, color, order: get().lists.length, isInbox: false },
          ],
        }),
      updateList: (id, patch) =>
        set({ lists: get().lists.map((l) => (l.id === id ? { ...l, ...patch } : l)) }),
      deleteList: (id) => {
        if (id === INBOX_ID) return
        set({
          lists: get().lists.filter((l) => l.id !== id),
          tasks: get().tasks.map((t) =>
            t.listId === id ? { ...t, listId: INBOX_ID, updatedAt: nowIso() } : t,
          ),
        })
      },

      addTag: (name, color) => {
        const tag: Tag = { id: uid('tag'), name, color }
        set({ tags: [...get().tags, tag] })
        return tag
      },
      updateTag: (id, patch) =>
        set({ tags: get().tags.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
      deleteTag: (id) =>
        set({
          tags: get().tags.filter((t) => t.id !== id),
          tasks: get().tasks.map((t) => ({
            ...t,
            tags: t.tags.filter((tid) => tid !== id),
          })),
        }),

      quickAdd: (raw, overrides = {}) => {
        const { cleanedTitle, dueAt } = parseNaturalDate(raw)
        return get().addTask({
          title: cleanedTitle || raw.trim(),
          dueAt,
          listId:
            get().activeView.kind === 'list'
              ? get().activeView.id
              : get().activeView.kind === 'smart' && get().activeView.id === 'inbox'
                ? INBOX_ID
                : INBOX_ID,
          ...overrides,
        })
      },

      addTask: (partial) => {
        const task: Task = {
          id: uid('task'),
          title: partial.title,
          listId: partial.listId ?? INBOX_ID,
          priority: partial.priority ?? 0,
          dueAt: partial.dueAt ?? null,
          remindAt: partial.remindAt ?? null,
          repeat: partial.repeat ?? null,
          tags: partial.tags ?? [],
          parentId: partial.parentId ?? null,
          checklist: partial.checklist ?? [],
          note: partial.note ?? '',
          status: 'todo',
          completedAt: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          order: get().tasks.length,
        }
        set({ tasks: [...get().tasks, task], selectedTaskId: task.id })
        return task
      },

      updateTask: (id, patch) =>
        set({
          tasks: get().tasks.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t,
          ),
        }),

      toggleComplete: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return
        if (task.status === 'todo') {
          const updates: Task[] = get().tasks.map((t) =>
            t.id === id
              ? { ...t, status: 'done' as TaskStatus, completedAt: nowIso(), updatedAt: nowIso() }
              : t,
          )
          // spawn next occurrence for repeating tasks
          if (task.repeat && task.dueAt) {
            const nextDue = nextRepeatDate(task.dueAt, task.repeat)
            const nextRemind = task.remindAt
              ? nextRepeatDate(task.remindAt, task.repeat)
              : null
            const clone: Task = {
              ...task,
              id: uid('task'),
              status: 'todo',
              completedAt: null,
              dueAt: nextDue,
              remindAt: nextRemind,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              checklist: task.checklist.map((c) => ({ ...c, id: uid('cl'), done: false })),
              order: get().tasks.length + 1,
            }
            set({ tasks: [...updates, clone] })
          } else {
            set({ tasks: updates })
          }
        } else if (task.status === 'done') {
          set({
            tasks: get().tasks.map((t) =>
              t.id === id
                ? { ...t, status: 'todo', completedAt: null, updatedAt: nowIso() }
                : t,
            ),
          })
        }
      },

      softDelete: (id) =>
        set({
          tasks: get().tasks.map((t) =>
            t.id === id || t.parentId === id
              ? { ...t, status: 'trashed' as TaskStatus, updatedAt: nowIso() }
              : t,
          ),
          selectedTaskId: get().selectedTaskId === id ? null : get().selectedTaskId,
        }),

      restoreTask: (id) =>
        set({
          tasks: get().tasks.map((t) =>
            t.id === id
              ? { ...t, status: 'todo', completedAt: null, updatedAt: nowIso() }
              : t,
          ),
        }),

      permanentlyDelete: (id) =>
        set({
          tasks: get().tasks.filter((t) => t.id !== id && t.parentId !== id),
          selectedTaskId: get().selectedTaskId === id ? null : get().selectedTaskId,
        }),

      emptyTrash: () =>
        set({
          tasks: get().tasks.filter((t) => t.status !== 'trashed'),
          selectedTaskId: null,
        }),

      abandonTask: (id) =>
        set({
          tasks: get().tasks.map((t) =>
            t.id === id ? { ...t, status: 'abandoned' as TaskStatus, updatedAt: nowIso() } : t,
          ),
        }),

      setTaskPriority: (id, priority) => get().updateTask(id, { priority }),
      moveTaskToList: (id, listId) => get().updateTask(id, { listId }),

      reorderTasks: (orderedIds) => {
        const map = new Map(orderedIds.map((id, i) => [id, i]))
        set({
          tasks: get().tasks.map((t) =>
            map.has(t.id) ? { ...t, order: map.get(t.id)! } : t,
          ),
        })
      },

      addSubtask: (parentId, title) => {
        const parent = get().tasks.find((t) => t.id === parentId)
        return get().addTask({
          title,
          parentId,
          listId: parent?.listId ?? INBOX_ID,
          priority: parent?.priority ?? 0,
        })
      },

      setChecklist: (taskId, items) => get().updateTask(taskId, { checklist: items }),

      toggleChecklistItem: (taskId, itemId) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return
        get().updateTask(taskId, {
          checklist: task.checklist.map((c) =>
            c.id === itemId ? { ...c, done: !c.done } : c,
          ),
        })
      },

      addPomodoroSession: (s) =>
        set({
          sessions: [
            ...get().sessions,
            { id: s.id ?? uid('pomo'), taskId: s.taskId ?? null, startedAt: s.startedAt, durationSec: s.durationSec, completed: s.completed },
          ],
        }),

      markReminderNotified: (taskId) =>
        set({ notifiedReminders: [...new Set([...get().notifiedReminders, taskId])] }),

      getVisibleTasks: () => {
        const { tasks, activeView, sortBy, filter } = get()
        let base = tasks.filter((t) => !t.parentId)

        switch (activeView.kind) {
          case 'smart':
            switch (activeView.id) {
              case 'inbox':
                base = base.filter((t) => t.status === 'todo' && t.listId === INBOX_ID)
                break
              case 'today':
                base = base.filter((t) => t.status === 'todo' && isToday(t.dueAt))
                break
              case 'tomorrow':
                base = base.filter((t) => t.status === 'todo' && isTomorrow(t.dueAt))
                break
              case 'next7':
                base = base.filter((t) => t.status === 'todo' && isWithinNext7Days(t.dueAt))
                break
              case 'all':
                base = base.filter((t) => t.status === 'todo')
                break
              case 'completed':
                base = base.filter((t) => t.status === 'done')
                break
              case 'abandoned':
                base = base.filter((t) => t.status === 'abandoned')
                break
              case 'trash':
                base = base.filter((t) => t.status === 'trashed')
                break
            }
            break
          case 'list':
            base = base.filter((t) => t.status === 'todo' && t.listId === activeView.id)
            break
          case 'tag':
            base = base.filter(
              (t) => t.status === 'todo' && t.tags.includes(activeView.id),
            )
            break
          case 'module':
            base = base.filter((t) => t.status === 'todo')
            break
        }

        return sortTasks(applyFilters(base, filter), sortBy)
      },

      getTaskById: (id) => get().tasks.find((t) => t.id === id),
      getSubtasks: (parentId) =>
        get().tasks.filter((t) => t.parentId === parentId && t.status !== 'trashed'),
    }),
    {
      name: 'dida-clone-storage',
      partialize: (s) => ({
        lists: s.lists,
        tags: s.tags,
        tasks: s.tasks,
        sessions: s.sessions,
        theme: s.theme,
        sortBy: s.sortBy,
        boardGroupBy: s.boardGroupBy,
        calendarMode: s.calendarMode,
        notifiedReminders: s.notifiedReminders,
      }),
    },
  ),
)

// re-export types used by UI for convenience
export type { RepeatRule }
