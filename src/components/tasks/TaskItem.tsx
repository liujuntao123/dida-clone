import { useState } from 'react'
import {
  Circle,
  CheckCircle2,
  Pin,
  Trash2,
  CalendarDays,
  FolderInput,
  Square,
  CheckSquare,
} from 'lucide-react'
import {
  LeadingActions,
  SwipeableListItem,
  SwipeAction,
  TrailingActions,
  Type as SwipeType,
} from 'react-swipeable-list'
import { useAppStore } from '../../store/useAppStore'
import { useToastStore } from '../../store/useToastStore'
import { PriorityFlag } from '../common/PriorityFlag'
import { formatDue, dayjs } from '../../lib/dates'
import { cn } from '../../lib/cn'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { Task } from '../../types'

function dueAtDay(offsetDays: number, preserveTime?: string | null) {
  const base = preserveTime ? dayjs(preserveTime) : dayjs().hour(18).minute(0).second(0)
  return dayjs()
    .add(offsetDays, 'day')
    .hour(base.hour())
    .minute(base.minute())
    .second(0)
    .millisecond(0)
    .toISOString()
}

export function TaskItem({ task, compact = false }: { task: Task; compact?: boolean }) {
  const isMobile = useIsMobile()
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const toggleComplete = useAppStore((s) => s.toggleComplete)
  const softDelete = useAppStore((s) => s.softDelete)
  const restoreTask = useAppStore((s) => s.restoreTask)
  const togglePin = useAppStore((s) => s.togglePin)
  const setTaskDue = useAppStore((s) => s.setTaskDue)
  const moveTaskToList = useAppStore((s) => s.moveTaskToList)
  const updateTask = useAppStore((s) => s.updateTask)
  const lists = useAppStore((s) => s.lists)
  const tags = useAppStore((s) => s.tags)
  const showToast = useToastStore((s) => s.show)
  const [moveOpen, setMoveOpen] = useState(false)

  const list = lists.find((l) => l.id === task.listId)
  const taskTags = tags.filter((t) => task.tags.includes(t.id))
  const done = task.status === 'done'
  const selected = selectedTaskId === task.id
  const pinned = !!task.pinned

  const completeWithUndo = () => {
    if (task.status === 'todo') {
      const snapshot = { status: task.status, completedAt: task.completedAt }
      toggleComplete(task.id)
      showToast('已完成', {
        undo: () => updateTask(task.id, snapshot),
      })
    } else {
      toggleComplete(task.id)
    }
  }

  const deleteWithUndo = () => {
    softDelete(task.id)
    showToast('已移到垃圾桶', {
      undo: () => restoreTask(task.id),
    })
  }

  const setDueWithToast = (label: string, dueAt: string) => {
    const prev = task.dueAt ?? null
    setTaskDue(task.id, dueAt)
    showToast(`已改期为${label}`, {
      undo: () => setTaskDue(task.id, prev),
    })
  }

  const leadingActions = (
    <LeadingActions>
      <SwipeAction onClick={completeWithUndo}>
        <div className="flex h-full min-w-[72px] flex-col items-center justify-center gap-0.5 bg-emerald-500 px-3 text-xs text-white">
          <CheckCircle2 size={18} />
          完成
        </div>
      </SwipeAction>
      <SwipeAction onClick={() => togglePin(task.id)}>
        <div className="flex h-full min-w-[72px] flex-col items-center justify-center gap-0.5 bg-amber-500 px-3 text-xs text-white">
          <Pin size={18} />
          {pinned ? '取消置顶' : '置顶'}
        </div>
      </SwipeAction>
    </LeadingActions>
  )

  const trailingActions = (
    <TrailingActions>
      <SwipeAction onClick={() => setDueWithToast('今天', dueAtDay(0, task.dueAt))}>
        <div className="flex h-full min-w-[64px] flex-col items-center justify-center gap-0.5 bg-brand px-2 text-xs text-white">
          <CalendarDays size={16} />
          今天
        </div>
      </SwipeAction>
      <SwipeAction onClick={() => setDueWithToast('明天', dueAtDay(1, task.dueAt))}>
        <div className="flex h-full min-w-[64px] flex-col items-center justify-center gap-0.5 bg-brand-hover px-2 text-xs text-white">
          <CalendarDays size={16} />
          明天
        </div>
      </SwipeAction>
      <SwipeAction onClick={() => setMoveOpen(true)}>
        <div className="flex h-full min-w-[64px] flex-col items-center justify-center gap-0.5 bg-violet-500 px-2 text-xs text-white">
          <FolderInput size={16} />
          移动
        </div>
      </SwipeAction>
      <SwipeAction destructive onClick={deleteWithUndo}>
        <div className="flex h-full min-w-[64px] flex-col items-center justify-center gap-0.5 bg-red-500 px-2 text-xs text-white">
          <Trash2 size={16} />
          删除
        </div>
      </SwipeAction>
    </TrailingActions>
  )

  const row = (
    <div
      className={cn(
        'group relative flex min-h-11 cursor-pointer items-start gap-2 px-3 py-2.5 transition',
        compact
          ? 'rounded-xl hover:bg-[var(--color-surface-2)]'
          : 'border-b border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]',
        selected && 'bg-brand/10',
        pinned && !compact && 'border-l-2 border-l-amber-400',
      )}
      onClick={() => setSelectedTaskId(task.id)}
    >
      <button
        type="button"
        className="mt-0.5 flex min-h-10 min-w-10 shrink-0 items-center justify-center text-[var(--color-muted)] hover:text-brand"
        onClick={(e) => {
          e.stopPropagation()
          completeWithUndo()
        }}
        aria-label={done ? '取消完成' : '完成'}
      >
        {done ? (
          compact ? <CheckSquare size={20} className="text-brand" /> : <CheckCircle2 size={20} className="text-green-500" />
        ) : (
          compact ? <Square size={20} strokeWidth={1.75} className="text-[#8E8E93]" /> : <Circle size={20} />
        )}
      </button>
      <div className="min-w-0 flex-1 py-0.5">
        <div className={cn('flex items-start gap-1.5 text-sm', done && 'line-through text-[var(--color-muted)]')}>
          {pinned && <Pin size={14} className="mt-0.5 shrink-0 text-amber-500" aria-label="已置顶" />}
          <span>{task.title}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
          <PriorityFlag priority={task.priority} size={12} />
          {task.dueAt && <span>{formatDue(task.dueAt)}</span>}
          {list && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: list.color }} />
              {list.name}
            </span>
          )}
          {taskTags.map((t) => (
            <span key={t.id} className="rounded px-1" style={{ background: `${t.color}22`, color: t.color }}>
              #{t.name}
            </span>
          ))}
          {task.checklist.length > 0 && (
            <span>
              {task.checklist.filter((c) => c.done).length}/{task.checklist.length}
            </span>
          )}
        </div>
      </div>

      {/* Desktop hover actions */}
      <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 md:flex">
        <button
          type="button"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-amber-500"
          title={pinned ? '取消置顶' : '置顶'}
          onClick={(e) => {
            e.stopPropagation()
            togglePin(task.id)
          }}
        >
          <Pin size={16} />
        </button>
        <button
          type="button"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-red-500"
          title="删除"
          onClick={(e) => {
            e.stopPropagation()
            deleteWithUndo()
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )

  const moveSheet = moveOpen ? (
    <div className="fixed inset-0 z-[90] flex items-end justify-center md:items-center" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="关闭" onClick={() => setMoveOpen(false)} />
      <div
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-[var(--color-card)] p-4 shadow-xl md:rounded-2xl "
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mb-3 text-sm font-semibold">移动到清单</div>
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-[var(--color-surface-2)]',
                l.id === task.listId && 'bg-brand/15 text-brand',
              )}
              onClick={() => {
                const prev = task.listId
                moveTaskToList(task.id, l.id)
                setMoveOpen(false)
                showToast(`已移动到「${l.name}」`, {
                  undo: () => moveTaskToList(task.id, prev),
                })
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
              {l.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null

  if (!isMobile) {
    return (
      <>
        {row}
        {moveSheet}
      </>
    )
  }

  return (
    <>
      <SwipeableListItem
        maxSwipe={0.7}
        threshold={0.35}
        fullSwipe
        listType={SwipeType.IOS}
        leadingActions={leadingActions}
        trailingActions={trailingActions}
        blockSwipe={done || task.status === 'trashed'}
      >
        {row}
      </SwipeableListItem>
      {moveSheet}
    </>
  )
}
