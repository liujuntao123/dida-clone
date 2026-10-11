import { useState } from 'react'
import {
  Circle,
  CheckCircle2,
  Pin,
  Trash2,
  CalendarDays,
  FolderInput,
  ListChecks,
  RotateCcw,
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
import { useBackHandler } from '../../lib/backNav'
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

export function TaskItem({
  task,
  compact = false,
  subCount,
}: {
  task: Task
  compact?: boolean
  subCount?: { done: number; total: number }
}) {
  const isMobile = useIsMobile()
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const toggleComplete = useAppStore((s) => s.toggleComplete)
  const softDelete = useAppStore((s) => s.softDelete)
  const restoreTask = useAppStore((s) => s.restoreTask)
  const permanentlyDelete = useAppStore((s) => s.permanentlyDelete)
  const togglePin = useAppStore((s) => s.togglePin)
  const setTaskDue = useAppStore((s) => s.setTaskDue)
  const moveTaskToList = useAppStore((s) => s.moveTaskToList)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const lists = useAppStore((s) => s.lists)
  const tags = useAppStore((s) => s.tags)
  const showToast = useToastStore((s) => s.show)
  const [moveOpen, setMoveOpen] = useState(false)
  // Android 返回键：先关「移动到清单」弹层
  useBackHandler(moveOpen, () => {
    setMoveOpen(false)
    return true
  })

  const list = lists.find((l) => l.id === task.listId)
  const taskTags = tags.filter((t) => task.tags.includes(t.id))
  const done = task.status === 'done'
  const selected = selectedTaskId === task.id
  const pinned = !!task.pinned

  /**
   * Revert to a `before` snapshot of the tasks array, while keeping tasks
   * created after it (e.g. a quick-add during the 5s undo window) — except
   * `dropId`, used to remove the spawned next occurrence of a repeating task.
   */
  const revertTasksTo = (before: Task[], dropId?: string | null) => {
    const snapIds = new Set(before.map((t) => t.id))
    const kept = useAppStore
      .getState()
      .tasks.filter((t) => !snapIds.has(t.id) && t.id !== dropId)
    useAppStore.setState({ tasks: [...before, ...kept] })
  }

  const completeWithUndo = () => {
    if (task.status === 'todo') {
      // Snapshot covers the task itself AND the next occurrence spawned for
      // repeating tasks — a field-level undo would leave the clone behind.
      const before = useAppStore.getState().tasks
      const spawnId = toggleComplete(task.id)
      showToast('已完成', { undo: () => revertTasksTo(before, spawnId) })
    } else {
      toggleComplete(task.id)
    }
  }

  const deleteWithUndo = () => {
    // Snapshot covers the task AND its trashed subtasks.
    const before = useAppStore.getState().tasks
    softDelete(task.id)
    showToast('已移到垃圾桶', { undo: () => revertTasksTo(before) })
  }

  const restoreWithToast = () => {
    restoreTask(task.id)
    showToast('已恢复')
  }

  const permanentDeleteWithConfirm = () => {
    if (task.status !== 'trashed') return
    if (!window.confirm(`永久删除「${task.title || '无标题'}」？此操作不可撤销。`)) return
    permanentlyDelete(task.id)
    showToast('已永久删除')
  }

  const setDueWithToast = (label: string, dueAt: string) => {
    const prev = task.dueAt ?? null
    setTaskDue(task.id, dueAt)
    showToast(`已改期为${label}`, {
      undo: () => setTaskDue(task.id, prev),
    })
  }

  // 呼出宽度 = 按钮总宽：react-swipeable-list 要求拖动超过 actions 总宽才能保持展开。
  // 控制在 ~170px（约 43% 屏宽），避免「要滑大半屏才呼出」。
  const leadingActions = (
    <LeadingActions>
      <SwipeAction onClick={completeWithUndo}>
        <div className="flex h-full min-w-[64px] flex-col items-center justify-center gap-0.5 bg-emerald-500 px-2 text-xs text-white">
          <CheckCircle2 size={18} />
          完成
        </div>
      </SwipeAction>
      <SwipeAction onClick={() => togglePin(task.id)}>
        <div className="flex h-full min-w-[64px] flex-col items-center justify-center gap-0.5 bg-amber-500 px-2 text-xs text-white">
          <Pin size={18} />
          {pinned ? '取消置顶' : '置顶'}
        </div>
      </SwipeAction>
    </LeadingActions>
  )

  const trailingActions = (
    <TrailingActions>
      <SwipeAction onClick={() => setDueWithToast('明天', dueAtDay(1, task.dueAt))}>
        <div className="flex h-full min-w-[56px] flex-col items-center justify-center gap-0.5 bg-brand px-1 text-xs text-white">
          <CalendarDays size={16} />
          明天
        </div>
      </SwipeAction>
      <SwipeAction onClick={() => setMoveOpen(true)}>
        <div className="flex h-full min-w-[56px] flex-col items-center justify-center gap-0.5 bg-violet-500 px-1 text-xs text-white">
          <FolderInput size={16} />
          移动
        </div>
      </SwipeAction>
      <SwipeAction destructive onClick={deleteWithUndo}>
        <div className="flex h-full min-w-[56px] flex-col items-center justify-center gap-0.5 bg-red-500 px-1 text-xs text-white">
          <Trash2 size={16} />
          删除
        </div>
      </SwipeAction>
    </TrailingActions>
  )

  const row = (
    <div
      className={cn(
        // w-full：react-swipeable-list 的 content 容器是 flex，不撑满会在行右侧留「点不中」的死区
        'group relative flex min-h-11 w-full cursor-pointer items-start gap-2 px-3 py-2.5 transition',
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
        className="mt-0.5 flex min-h-10 min-w-10 shrink-0 items-center justify-center text-[var(--color-muted)] hover:text-brand disabled:opacity-40"
        disabled={task.status === 'trashed' || task.status === 'abandoned'}
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
        <div className={cn('flex items-start gap-1.5 text-[15px] leading-snug', done && 'text-[var(--color-muted)] line-through')}>
          {pinned && <Pin size={14} className="mt-0.5 shrink-0 text-amber-500" aria-label="已置顶" />}
          <span>{task.title}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-muted)]">
          <PriorityFlag priority={task.priority} size={12} />
          {task.dueAt && <span>{formatDue(task.dueAt)}</span>}
          {list && (
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-[var(--color-fg)]"
              title={`查看清单「${list.name}」`}
              onClick={(e) => {
                e.stopPropagation()
                setActiveView({ kind: 'list', id: list.id })
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: list.color }} />
              {list.name}
            </button>
          )}
          {taskTags.map((t) => (
            <button
              key={t.id}
              type="button"
              className="rounded px-1 hover:opacity-80"
              style={{ background: `${t.color}22`, color: t.color }}
              title={`查看标签「${t.name}」`}
              onClick={(e) => {
                e.stopPropagation()
                setActiveView({ kind: 'tag', id: t.id })
              }}
            >
              #{t.name}
            </button>
          ))}
          {task.checklist.length > 0 && (
            <span>
              {task.checklist.filter((c) => c.done).length}/{task.checklist.length}
            </span>
          )}
          {subCount && subCount.total > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <ListChecks size={12} />
              {subCount.done}/{subCount.total}
            </span>
          )}
        </div>
      </div>

      {/* Desktop hover actions — 随任务状态变化，避免出现「点了没反应」的按钮 */}
      <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 md:flex">
        {task.status === 'trashed' ? (
          <>
            <button
              type="button"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-emerald-500"
              title="恢复"
              onClick={(e) => {
                e.stopPropagation()
                restoreWithToast()
              }}
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-red-500"
              title="永久删除"
              onClick={(e) => {
                e.stopPropagation()
                permanentDeleteWithConfirm()
              }}
            >
              <Trash2 size={16} />
            </button>
          </>
        ) : task.status === 'abandoned' ? (
          <>
            <button
              type="button"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-emerald-500"
              title="恢复"
              onClick={(e) => {
                e.stopPropagation()
                restoreWithToast()
              }}
            >
              <RotateCcw size={16} />
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
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )

  const moveSheet = moveOpen ? (
    <div className="fixed inset-0 z-[90] flex items-end justify-center md:items-center" role="dialog" aria-modal>
      <button
        type="button"
        className="animate-fade-in absolute inset-0 bg-black/40"
        aria-label="关闭"
        onClick={() => setMoveOpen(false)}
      />
      <div
        className="animate-slide-up relative z-10 w-full max-w-md rounded-t-2xl bg-[var(--color-card)] p-4 shadow-xl md:rounded-2xl"
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
        // fullSwipe 关闭：左/右滑只展开操作按钮，需点按才触发，
        // 不会再出现「一滑就删除」的误触。
        listType={SwipeType.IOS}
        leadingActions={leadingActions}
        trailingActions={trailingActions}
        blockSwipe={task.status === 'trashed'}
      >
        {row}
      </SwipeableListItem>
      {moveSheet}
    </>
  )
}
