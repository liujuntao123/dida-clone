import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronDown, ChevronRight, Menu, MoreVertical } from 'lucide-react'
import { SwipeableList, Type as SwipeType } from 'react-swipeable-list'
import 'react-swipeable-list/dist/styles.css'
import { useAppStore } from '../../store/useAppStore'
import { TaskItem } from './TaskItem'
import { QuickAdd } from './QuickAdd'
import { FilterBar } from './FilterBar'
import { TaskDetail } from './TaskDetail'
import { useIsMobile } from '../../hooks/useIsMobile'
import { dayjs } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { Task } from '../../types'

type Group = { key: string; title: string; tasks: Task[] }

function groupByDue(tasks: Task[]): Group[] {
  const overdue: Task[] = []
  const today: Task[] = []
  const tomorrow: Task[] = []
  const later: Task[] = []
  const noDate: Task[] = []
  const start = dayjs().startOf('day')
  const endToday = dayjs().endOf('day')
  const endTomorrow = dayjs().add(1, 'day').endOf('day')

  for (const t of tasks) {
    if (!t.dueAt) {
      noDate.push(t)
      continue
    }
    const d = dayjs(t.dueAt)
    if (d.isBefore(start)) overdue.push(t)
    else if (!d.isAfter(endToday)) today.push(t)
    else if (!d.isAfter(endTomorrow)) tomorrow.push(t)
    else later.push(t)
  }

  const groups: Group[] = []
  if (overdue.length) groups.push({ key: 'overdue', title: '已过期', tasks: overdue })
  if (today.length) groups.push({ key: 'today', title: '今天', tasks: today })
  if (tomorrow.length) groups.push({ key: 'tomorrow', title: '明天', tasks: tomorrow })
  if (later.length) groups.push({ key: 'later', title: '近期', tasks: later })
  if (noDate.length) groups.push({ key: 'nodate', title: '没有日期', tasks: noDate })
  return groups
}

function groupByList(tasks: Task[], lists: { id: string; name: string }[]): Group[] {
  const map = new Map<string, Task[]>()
  for (const t of tasks) {
    const arr = map.get(t.listId) ?? []
    arr.push(t)
    map.set(t.listId, arr)
  }
  return [...map.entries()].map(([id, ts]) => ({
    key: id,
    title: lists.find((l) => l.id === id)?.name ?? '清单',
    tasks: ts,
  }))
}

function TaskGroupCard({
  group,
  isMobile,
  defaultOpen = true,
}: {
  group: Group
  isMobile: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-2xl bg-[var(--color-card)]">
      <button
        type="button"
        className="flex w-full min-h-11 items-center justify-between px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[15px] font-medium text-[var(--color-fg)]">{group.title}</span>
        <span className="flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
          {group.tasks.length}
          <ChevronDown size={16} className={cn('transition', !open && '-rotate-90')} />
        </span>
      </button>
      {open && (
        <div className="px-1 pb-2">
          {isMobile ? (
            <SwipeableList type={SwipeType.IOS} fullSwipe threshold={0.35} className="swipe-task-list">
              {group.tasks.map((t) => (
                <TaskItem key={t.id} task={t} compact />
              ))}
            </SwipeableList>
          ) : (
            group.tasks.map((t) => <TaskItem key={t.id} task={t} compact />)
          )}
        </div>
      )}
    </div>
  )
}

export function TaskListPanel() {
  const isMobile = useIsMobile()
  const tasks = useAppStore(useShallow((s) => s.getVisibleTasks()))
  const allTasks = useAppStore((s) => s.tasks)
  const activeView = useAppStore((s) => s.activeView)
  const lists = useAppStore((s) => s.lists)
  const tags = useAppStore((s) => s.tags)
  const emptyTrash = useAppStore((s) => s.emptyTrash)
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const setActiveView = useAppStore((s) => s.setActiveView)

  let title = '任务'
  if (activeView.kind === 'smart') {
    const map: Record<string, string> = {
      inbox: '收集箱',
      today: '今天',
      tomorrow: '明天',
      next7: '最近7天',
      all: '所有',
      completed: '已完成',
      abandoned: '已放弃',
      trash: '垃圾桶',
    }
    title = map[activeView.id] ?? '任务'
  } else if (activeView.kind === 'list') {
    title = lists.find((l) => l.id === activeView.id)?.name ?? '清单'
  } else if (activeView.kind === 'tag') {
    title = `#${tags.find((t) => t.id === activeView.id)?.name ?? '标签'}`
  }

  const showQuickAdd =
    activeView.kind === 'list' ||
    (activeView.kind === 'smart' &&
      ['inbox', 'today', 'tomorrow', 'next7', 'all'].includes(activeView.id)) ||
    activeView.kind === 'tag'

  const useDateGroups =
    activeView.kind === 'smart' && ['all', 'next7', 'today', 'tomorrow', 'inbox'].includes(activeView.id)

  const groups = useMemo(() => {
    if (tasks.length === 0) return []
    if (useDateGroups) return groupByDue(tasks)
    if (activeView.kind === 'smart' && activeView.id === 'all') return groupByList(tasks, lists)
    return [{ key: 'all', title, tasks }]
  }, [tasks, useDateGroups, activeView, lists, title])

  const doneAbandonedCount = useMemo(
    () => allTasks.filter((t) => !t.parentId && (t.status === 'done' || t.status === 'abandoned')).length,
    [allTasks],
  )

  const listBody =
    tasks.length === 0 ? (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <p className="text-base text-[var(--color-fg)]/80">暂无任务</p>
        <p className="text-sm text-[var(--color-muted)]">点右下角 + 添加一件事</p>
      </div>
    ) : (
      <div className="flex flex-col gap-3 px-3 py-3">
        {groups.map((g) => (
          <TaskGroupCard key={g.key} group={g} isMobile={isMobile} />
        ))}
        {activeView.kind === 'smart' &&
          ['all', 'today', 'next7', 'inbox'].includes(activeView.id) &&
          doneAbandonedCount > 0 && (
            <button
              type="button"
              className="flex min-h-11 items-center justify-between rounded-2xl bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-muted)]"
              onClick={() => setActiveView({ kind: 'smart', id: 'completed' })}
            >
              <span>已完成 & 已放弃</span>
              <span className="flex items-center gap-1">
                {doneAbandonedCount}
                <ChevronRight size={16} />
              </span>
            </button>
          )}
      </div>
    )

  return (
    <div className="flex h-full min-w-0 flex-1 bg-[var(--color-surface-2)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="flex min-h-12 items-center gap-1 bg-[var(--color-surface)] px-2"
          style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}
        >
          {isMobile && (
            <button
              type="button"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-fg)]"
              onClick={() => setSidebarOpen(true)}
              aria-label="打开菜单"
            >
              <Menu size={22} />
            </button>
          )}
          <h1 className="flex-1 truncate text-center text-lg font-semibold md:text-left md:pl-2">{title}</h1>
          {isMobile ? (
            <button type="button" className="flex min-h-11 min-w-11 items-center justify-center text-[var(--color-muted)]" aria-label="更多">
              <MoreVertical size={20} />
            </button>
          ) : (
            <span className="pr-3 text-xs text-[var(--color-muted)]">{tasks.length} 项</span>
          )}
        </div>
        {showQuickAdd && !isMobile && <QuickAdd />}
        {showQuickAdd && !isMobile && <FilterBar />}
        {activeView.kind === 'smart' && activeView.id === 'trash' && (
          <div className="border-b border-[var(--color-border)] px-3 py-2">
            <button type="button" className="min-h-11 text-sm text-red-500 active:opacity-80" onClick={() => emptyTrash()}>
              清空垃圾桶
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto pb-4">{listBody}</div>
      </div>

      {!isMobile && (
        selectedTaskId ? (
          <div className="flex h-full">
            <TaskDetail variant="panel" />
          </div>
        ) : (
          <div className="hidden lg:flex">
            <TaskDetail variant="panel" />
          </div>
        )
      )}
    </div>
  )
}
