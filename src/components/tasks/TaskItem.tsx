import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Circle,
  CheckCircle2,
  Pin,
  Trash2,
  FolderInput,
  RotateCcw,
  Square,
  CheckSquare,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useToastStore } from '../../store/useToastStore'
import { PriorityFlag } from '../common/PriorityFlag'
import { ProgressRing } from '../common/ProgressRing'
import { SwipeRow, type SwipeSide } from './SwipeRow'
import { formatDue } from '../../lib/dates'
import { cn } from '../../lib/cn'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useBackHandler } from '../../lib/backNav'
import type { Task } from '../../types'

/**
 * 左右滑操作（SwipeRow 自研实现）：
 * 拖过 ~64px 或一记快扫即呼出按钮，点按按钮才触发（fullSwipe 永不开启）。
 * 只在右侧呼出，纯图标按钮固定宽度：移动 / 删除 2×52 = 104px。
 */
const TRAIL_ACTION_W = 52
const TRAILING_W = TRAIL_ACTION_W * 2 // 移动 / 删除

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

  // —— 左右滑展开态：跟踪 + 收起 ——
  const rowRef = useRef<HTMLDivElement | null>(null)
  const [openSide, setOpenSide] = useState<SwipeSide | null>(null)
  const closeActions = useCallback(() => setOpenSide(null), [])

  // 展开时：点击本行操作按钮以外的任意空白处（其他行 / 页面空白）收起
  useEffect(() => {
    if (!openSide) return
    const onPointerDown = (e: PointerEvent) => {
      const wrap = rowRef.current?.closest('.swipeable-list-item')
      if (wrap?.contains(e.target as Node)) return
      closeActions()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [openSide, closeActions])

  /** 点按操作按钮：先执行动作再收起（删除不收，交给行移除）。 */
  const withClose = (fn: () => void) => () => {
    fn()
    closeActions()
  }

  const list = lists.find((l) => l.id === task.listId)
  const taskTags = tags.filter((t) => task.tags.includes(t.id))
  const done = task.status === 'done'
  const selected = selectedTaskId === task.id
  const pinned = !!task.pinned
  const subProgress = subCount && subCount.total > 0 ? Math.round((subCount.done / subCount.total) * 100) : null

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

  const actionBtnCls = (bg: string) =>
    cn(
      'swipe-action swipe-action__trailing flex h-full w-[52px] items-center justify-center text-white active:brightness-95',
      bg,
    )

  const trailingActions = (
    <>
      <button
        type="button"
        aria-label="移动到清单"
        className={actionBtnCls('bg-violet-500')}
        onClick={withClose(() => setMoveOpen(true))}
      >
        <FolderInput size={20} />
      </button>
      <button
        type="button"
        aria-label="删除任务"
        className={actionBtnCls('bg-red-500')}
        onClick={deleteWithUndo}
      >
        <Trash2 size={20} />
      </button>
    </>
  )

  const row = (
    <div
      ref={rowRef}
      className={cn(
        // w-full：content 容器是 flex，不撑满会在行右侧留「点不中」的死区
        'group relative flex min-h-11 w-full cursor-pointer items-start gap-2 px-3 py-2.5 transition',
        compact
          ? 'rounded-xl hover:bg-[var(--color-surface-2)]'
          : 'border-b border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]',
        selected && 'bg-brand/10',
        pinned && !compact && 'border-l-2 border-l-amber-400',
      )}
      onClick={() => {
        // 已展开时点行内空白 = 收起，而不是打开详情
        if (openSide) {
          closeActions()
          return
        }
        setSelectedTaskId(task.id)
      }}
    >
      {/* 展开态遮罩：挡住行内控件，点按即收起（按钮在遮罩外，仍可点按触发） */}
      {openSide && (
        <div
          className="absolute inset-0 z-10"
          aria-hidden
          onClick={(e) => {
            e.stopPropagation()
            closeActions()
          }}
        />
      )}
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
        <div className={cn('flex items-start gap-1.5 text-sm leading-snug', done && 'text-[var(--color-muted)] line-through')}>
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
        </div>
      </div>

      {/* 右侧子任务进度环 */}
      {subProgress != null && (
        <span className="mt-1 shrink-0 self-center" title={`子任务 ${subCount!.done}/${subCount!.total}`}>
          <ProgressRing percent={subProgress} size={18} stroke={2.5} />
        </span>
      )}

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
      <SwipeRow
        open={openSide !== null}
        side={openSide}
        onOpenChange={setOpenSide}
        leadingWidth={0}
        trailingWidth={TRAILING_W}
        trailingActions={trailingActions}
        blockSwipe={task.status === 'trashed'}
      >
        {row}
      </SwipeRow>
      {moveSheet}
    </>
  )
}
