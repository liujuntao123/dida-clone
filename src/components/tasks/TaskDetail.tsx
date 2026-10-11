import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  ChevronsUpDown,
  GripVertical,
  ListTodo,
  ListTree,
  MoreVertical,
  Pin,
  Plus,
  RotateCcw,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { PRIORITY_LABELS, TAG_COLORS } from '../../lib/constants'
import { dayjs } from '../../lib/dates'
import { uid } from '../../lib/id'
import { useBackHandler } from '../../lib/backNav'
import { PriorityFlag } from '../common/PriorityFlag'
import type { Priority, Task } from '../../types'
import { cn } from '../../lib/cn'

function ProgressRing({ percent, size = 28 }: { percent: number; size?: number }) {
  const stroke = 2.5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(100, Math.max(0, percent)) / 100)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`进度 ${percent}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-[var(--color-muted)]">
        {percent}%
      </span>
    </div>
  )
}

/** 与 TaskItem 的快速改期保持一致：保留原时间，只挪日期。 */
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

/**
 * TickTick-style subtask row: rounded-square checkbox, title (tap to open its
 * own detail), hover delete, and a drag handle for reordering.
 */
function SortableSubtaskRow({
  sub,
  showTopBorder,
  onToggle,
  onOpen,
  onDelete,
}: {
  sub: Task
  showTopBorder: boolean
  onToggle: () => void
  onOpen: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: sub.id })
  const done = sub.status === 'done'
  const titleEmpty = !sub.title.trim()

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-start gap-3 py-3',
        showTopBorder && 'border-t border-[var(--color-border)]',
        isDragging && 'relative z-10 rounded-xl bg-[var(--color-card)] shadow-md',
      )}
    >
      <button
        type="button"
        aria-label={done ? '取消完成' : '完成子任务'}
        onClick={onToggle}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 transition',
          done
            ? 'border-brand bg-brand text-white'
            : 'border-[var(--color-muted)]/70 text-transparent hover:border-brand',
        )}
      >
        <Check size={12} strokeWidth={3.5} />
      </button>
      <button
        type="button"
        className={cn(
          'accent-caret min-w-0 flex-1 truncate text-left text-[15px]',
          done ? 'text-[var(--color-muted)] line-through' : 'text-[var(--color-fg)]',
        )}
        onClick={onOpen}
      >
        {titleEmpty ? <span className="text-[var(--color-muted)]">新子任务</span> : sub.title}
      </button>
      <button
        type="button"
        aria-label="删除子任务"
        className="shrink-0 text-[var(--color-muted)]/50 hover:text-red-500 md:text-[var(--color-muted)] md:opacity-0 md:transition md:group-hover:opacity-100"
        onClick={onDelete}
      >
        <Trash2 size={15} />
      </button>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        onPointerDown={(e) => {
          // Keep vaul from dragging the whole sheet while reordering.
          e.stopPropagation()
          listeners?.onPointerDown?.(e)
        }}
        aria-label="拖动排序"
        className="mt-0.5 flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-[var(--color-muted)]/60 active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
    </li>
  )
}

export function TaskDetail({ variant = 'panel' }: { variant?: 'panel' | 'sheet' }) {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const tasks = useAppStore((s) => s.tasks)
  const lists = useAppStore((s) => s.lists)
  const tags = useAppStore((s) => s.tags)
  const updateTask = useAppStore((s) => s.updateTask)
  const softDelete = useAppStore((s) => s.softDelete)
  const restoreTask = useAppStore((s) => s.restoreTask)
  const permanentlyDelete = useAppStore((s) => s.permanentlyDelete)
  const abandonTask = useAppStore((s) => s.abandonTask)
  const toggleComplete = useAppStore((s) => s.toggleComplete)
  const togglePin = useAppStore((s) => s.togglePin)
  const toggleChecklistItem = useAppStore((s) => s.toggleChecklistItem)
  const setChecklist = useAppStore((s) => s.setChecklist)
  const getSubtasks = useAppStore((s) => s.getSubtasks)
  const addSubtask = useAppStore((s) => s.addSubtask)
  const reorderSubtasks = useAppStore((s) => s.reorderSubtasks)
  const addTag = useAppStore((s) => s.addTag)

  const task = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId],
  )

  const [listOpen, setListOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [checkText, setCheckText] = useState('')
  const [subText, setSubText] = useState('')
  const [newTagText, setNewTagText] = useState('')
  const checkInputRef = useRef<HTMLInputElement>(null)
  const subInputRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const closePopovers = useCallback(() => {
    setListOpen(false)
    setPriorityOpen(false)
    setMenuOpen(false)
    setTagsOpen(false)
    setDateOpen(false)
  }, [])

  // Android 返回键 / 视图层兜底：先收起详情内打开的弹出层
  const anyPopoverOpen = listOpen || priorityOpen || menuOpen || tagsOpen || dateOpen
  useBackHandler(anyPopoverOpen, () => {
    closePopovers()
    return true
  })

  useEffect(() => {
    setListOpen(false)
    setPriorityOpen(false)
    setMenuOpen(false)
    setTagsOpen(false)
    setDateOpen(false)
    setEditingNote(false)
    setCheckText('')
    setSubText('')
    setNewTagText('')
  }, [selectedTaskId])

  // Esc 收起弹出层（桌面键盘友好）
  useEffect(() => {
    if (!anyPopoverOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopovers()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anyPopoverOpen, closePopovers])

  // Keep the auto-growing title textarea sized when switching tasks
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [selectedTaskId, task?.title])

  if (!task) {
    if (variant === 'sheet') return null
    return (
      <div className="hidden h-full items-center justify-center text-sm text-[var(--color-muted)] md:flex md:w-[340px] lg:w-[360px] lg:border-l lg:border-[var(--color-border)] lg:bg-[var(--color-card)]">
        选择任务查看详情
      </div>
    )
  }

  const list = lists.find((l) => l.id === task.listId)
  const subtasks = getSubtasks(task.id)
  const isTopLevel = !task.parentId
  const checkDone = task.checklist.filter((c) => c.done).length
  const checkTotal = task.checklist.length
  const subDone = subtasks.filter((s) => s.status === 'done').length
  const subTotal = subtasks.length
  const progressTotal = checkTotal + subTotal
  const progressDone = checkDone + subDone
  const progressPct = progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0

  const dueLocal = task.dueAt ? dayjs(task.dueAt).format('YYYY-MM-DDTHH:mm') : ''
  const remindLocal = task.remindAt ? dayjs(task.remindAt).format('YYYY-MM-DDTHH:mm') : ''
  const dateLabel = (() => {
    if (task.dueAt) {
      const d = dayjs(task.dueAt)
      const base = d.format(d.year() === dayjs().year() ? 'M月D日 HH:mm' : 'YYYY年M月D日 HH:mm')
      if (task.remindAt) return `${base} · 提醒`
      return base
    }
    if (task.remindAt) return `提醒 ${dayjs(task.remindAt).format('M月D日 HH:mm')}`
    return '日期与提醒'
  })()

  const cyclePriority = () => {
    const next = ((task.priority + 1) % 4) as Priority
    updateTask(task.id, { priority: next })
  }

  /** 回车即添加检查项，并保持焦点支持连续录入。 */
  const submitCheck = () => {
    if (!checkText.trim()) return
    setChecklist(task.id, [
      ...task.checklist,
      { id: uid('cl'), text: checkText.trim(), done: false },
    ])
    setCheckText('')
    requestAnimationFrame(() => checkInputRef.current?.focus())
  }

  /** 已完成项沉底（TickTick 的检查项排序）。 */
  const sortChecklist = () => {
    const undone = task.checklist.filter((c) => !c.done)
    const doneItems = task.checklist.filter((c) => c.done)
    setChecklist(task.id, [...undone, ...doneItems])
  }

  const submitSub = () => {
    // 空输入也允许继续添加下一条（连续录入），空内容使用默认标题「新子任务」
    const t = subText.trim()
    addSubtask(task.id, t || '新子任务')
    setSubText('')
    // keep focus so several subtasks can be added in a row
    requestAnimationFrame(() => subInputRef.current?.focus())
  }

  /** 从详情面板快速新建标签：重名则复用，创建后自动挂到当前任务。 */
  const createTagAndAssign = () => {
    const clean = newTagText.trim().replace(/^#/, '')
    if (!clean) return
    const existing = tags.find((t) => t.name === clean)
    const tag = existing ?? addTag(clean, TAG_COLORS[tags.length % TAG_COLORS.length])
    if (!task.tags.includes(tag.id)) {
      updateTask(task.id, { tags: [...task.tags, tag.id] })
    }
    setNewTagText('')
  }

  const handleSubDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = subtasks.map((s) => s.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    reorderSubtasks(task.id, arrayMove(ids, from, to))
  }

  const parentTask = task.parentId ? tasks.find((t) => t.id === task.parentId) : undefined

  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col bg-[var(--color-card)]',
        variant === 'panel' && 'border-l border-[var(--color-border)] md:w-[340px] lg:w-[380px]',
      )}
      onClick={() => closePopovers()}
    >
      {/* Top bar：清单切换 + 优先级 + 更多（复刻抽屉头部） */}
      <div
        className={cn(
          'relative flex min-h-12 shrink-0 items-center justify-between px-3',
          variant === 'panel' && 'border-b border-[var(--color-border)]',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {parentTask ? (
          <button
            type="button"
            className="flex min-h-11 max-w-full items-center gap-1 text-[15px] text-[var(--color-fg)]"
            onClick={() => {
              setListOpen(false)
              setPriorityOpen(false)
              setMenuOpen(false)
              setSelectedTaskId(parentTask.id)
            }}
            aria-label={`返回「${parentTask.title}」`}
          >
            <ArrowLeft size={16} className="shrink-0 text-[var(--color-muted)]" />
            <span className="truncate text-[var(--color-muted)]">{parentTask.title}</span>
          </button>
        ) : (
          <button
            type="button"
            className="flex min-h-11 max-w-[55%] items-center gap-1 text-[15px] text-[var(--color-fg)]"
            onClick={() => {
              setPriorityOpen(false)
              setMenuOpen(false)
              setListOpen((v) => !v)
            }}
          >
            <span className="truncate">{list?.name ?? '清单'}</span>
            <ChevronsUpDown size={14} className="shrink-0 text-[var(--color-muted)]" />
          </button>
        )}

        <div className="flex items-center">
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center text-[var(--color-muted)] active:opacity-70"
            aria-label={`优先级：${PRIORITY_LABELS[task.priority]}`}
            onClick={() => {
              setListOpen(false)
              setMenuOpen(false)
              setPriorityOpen((v) => !v)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              cyclePriority()
            }}
          >
            <PriorityFlag priority={task.priority} size={18} />
          </button>
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center text-[var(--color-muted)] active:opacity-70"
            aria-label="更多"
            onClick={() => {
              setListOpen(false)
              setPriorityOpen(false)
              setMenuOpen((v) => !v)
            }}
          >
            <MoreVertical size={20} />
          </button>
        </div>

        {listOpen && (
          <div className="animate-fade-in absolute left-3 top-12 z-20 max-h-56 w-48 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg">
            {lists.map((l) => (
              <button
                key={l.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm',
                  l.id === task.listId ? 'bg-brand/15 text-brand' : 'hover:bg-[var(--color-surface-2)]',
                )}
                onClick={() => {
                  updateTask(task.id, { listId: l.id })
                  setListOpen(false)
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.name}
              </button>
            ))}
          </div>
        )}

        {priorityOpen && (
          <div className="animate-fade-in absolute right-12 top-12 z-20 w-36 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg">
            {([3, 2, 1, 0] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm',
                  task.priority === p ? 'bg-brand/15 text-brand' : 'hover:bg-[var(--color-surface-2)]',
                )}
                onClick={() => {
                  updateTask(task.id, { priority: p })
                  setPriorityOpen(false)
                }}
              >
                <PriorityFlag priority={p} size={14} />
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        )}

        {menuOpen && (
          <div className="animate-fade-in absolute right-3 top-12 z-20 w-40 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg">
            {task.status === 'todo' && (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface-2)]"
                  onClick={() => {
                    togglePin(task.id)
                    setMenuOpen(false)
                  }}
                >
                  <Pin size={14} className={task.pinned ? 'text-amber-500' : ''} />
                  {task.pinned ? '取消置顶' : '置顶'}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface-2)]"
                  onClick={() => {
                    abandonTask(task.id)
                    setMenuOpen(false)
                  }}
                >
                  <Ban size={14} /> 放弃
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-500 hover:bg-[var(--color-surface-2)]"
                  onClick={() => {
                    softDelete(task.id)
                    setMenuOpen(false)
                  }}
                >
                  <Trash2 size={14} /> 删除
                </button>
              </>
            )}
            {task.status === 'done' && (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface-2)]"
                  onClick={() => {
                    toggleComplete(task.id)
                    setMenuOpen(false)
                  }}
                >
                  <RotateCcw size={14} /> 恢复未完成
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-500 hover:bg-[var(--color-surface-2)]"
                  onClick={() => {
                    softDelete(task.id)
                    setMenuOpen(false)
                  }}
                >
                  <Trash2 size={14} /> 删除
                </button>
              </>
            )}
            {(task.status === 'abandoned' || task.status === 'trashed') && (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface-2)]"
                  onClick={() => {
                    restoreTask(task.id)
                    setMenuOpen(false)
                  }}
                >
                  <RotateCcw size={14} /> 恢复
                </button>
                {task.status === 'trashed' && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-500 hover:bg-[var(--color-surface-2)]"
                    onClick={() => {
                      permanentlyDelete(task.id)
                      setMenuOpen(false)
                    }}
                  >
                    <Trash2 size={14} /> 永久删除
                  </button>
                )}
              </>
            )}
            {variant === 'panel' && (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface-2)]"
                onClick={() => {
                  setSelectedTaskId(null)
                  setMenuOpen(false)
                }}
              >
                关闭
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        {/* 日期与提醒行（复刻：图标 + 文本，整行可点开编辑区） */}
        <div className="mb-1 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label={task.status === 'done' ? '标为未完成' : '完成'}
            disabled={task.status === 'trashed' || task.status === 'abandoned'}
            onClick={() => toggleComplete(task.id)}
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition',
              task.status === 'done'
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-[var(--color-muted)] text-transparent',
            )}
          >
            <Check size={14} strokeWidth={3} />
          </button>
          <button
            type="button"
            className={cn(
              'min-h-11 flex flex-1 items-center gap-2.5 text-left text-[15px]',
              task.dueAt || task.remindAt ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]',
            )}
            onClick={() => {
              closePopovers()
              setDateOpen((v) => !v)
            }}
          >
            <CalendarDays size={18} strokeWidth={1.75} className="shrink-0 opacity-80" />
            <span className="truncate">{dateLabel}</span>
          </button>
          {progressTotal > 0 && <ProgressRing percent={progressPct} />}
        </div>

        {dateOpen && (
          <div
            className="animate-fade-in mb-3 space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 快捷改期 */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-9 rounded-full bg-brand/15 px-3.5 text-xs text-brand active:opacity-80"
                onClick={() => updateTask(task.id, { dueAt: dueAtDay(0, task.dueAt) })}
              >
                今天
              </button>
              <button
                type="button"
                className="min-h-9 rounded-full bg-brand/15 px-3.5 text-xs text-brand active:opacity-80"
                onClick={() => updateTask(task.id, { dueAt: dueAtDay(1, task.dueAt) })}
              >
                明天
              </button>
              {(task.dueAt || task.remindAt) && (
                <button
                  type="button"
                  className="min-h-9 rounded-full border border-[var(--color-border)] px-3.5 text-xs text-[var(--color-muted)] active:opacity-80"
                  onClick={() => updateTask(task.id, { dueAt: null, remindAt: null })}
                >
                  清除
                </button>
              )}
            </div>
            <label className="block text-xs text-[var(--color-muted)]">
              截止日期
              <input
                type="datetime-local"
                value={dueLocal}
                onChange={(e) =>
                  updateTask(task.id, {
                    dueAt: e.target.value ? dayjs(e.target.value).toISOString() : null,
                  })
                }
                className="field-focus mt-1 w-full rounded-lg bg-[var(--color-card)] px-2.5 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-[var(--color-muted)]">
              提醒
              <input
                type="datetime-local"
                value={remindLocal}
                onChange={(e) =>
                  updateTask(task.id, {
                    remindAt: e.target.value ? dayjs(e.target.value).toISOString() : null,
                  })
                }
                className="field-focus mt-1 w-full rounded-lg bg-[var(--color-card)] px-2.5 py-2 text-sm"
              />
            </label>
          </div>
        )}

        {/* Title */}
        <textarea
          ref={titleRef}
          value={task.title}
          onChange={(e) => updateTask(task.id, { title: e.target.value })}
          rows={1}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${el.scrollHeight}px`
          }}
          className="accent-caret mb-1 mt-2 w-full resize-none border-0 bg-transparent text-[22px] font-semibold leading-snug text-[var(--color-fg)] outline-none"
          placeholder="任务标题"
        />

        {/* Tags：chips 常驻 + 「＋标签」入口，点开编辑面板 */}
        <div className="mb-1 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {task.tags.map((tid) => {
            const t = tags.find((x) => x.id === tid)
            if (!t) return null
            return (
              <button
                key={tid}
                type="button"
                className={cn(
                  'flex min-h-8 items-center gap-1 rounded-full px-2.5 text-xs',
                  tagsOpen ? 'text-white' : 'text-white',
                )}
                style={{ background: t.color }}
                title={tagsOpen ? '点击移除标签' : '管理标签'}
                onClick={() => {
                  if (tagsOpen) {
                    updateTask(task.id, { tags: task.tags.filter((id) => id !== tid) })
                  } else {
                    closePopovers()
                    setTagsOpen(true)
                  }
                }}
              >
                #{t.name}
                {tagsOpen && <X size={11} strokeWidth={2.5} />}
              </button>
            )
          })}
          <button
            type="button"
            className={cn(
              'flex min-h-8 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs',
              tagsOpen
                ? 'border-brand text-brand'
                : 'border-[var(--color-border)] text-[var(--color-muted)]',
            )}
            onClick={() => {
              setDateOpen(false)
              setTagsOpen((v) => !v)
            }}
          >
            <TagIcon size={12} />
            {task.tags.length > 0 ? '编辑' : '标签'}
          </button>
        </div>

        {/* Tags panel */}
        {tagsOpen && (
          <div
            className="animate-fade-in mb-2 flex flex-wrap gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {tags.map((t) => {
              const on = task.tags.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    updateTask(task.id, {
                      tags: on ? task.tags.filter((id) => id !== t.id) : [...task.tags, t.id],
                    })
                  }
                  className={cn(
                    'min-h-9 rounded-full px-2.5 py-1 text-xs',
                    on ? 'text-white' : 'border border-[var(--color-border)]',
                  )}
                  style={on ? { background: t.color } : undefined}
                >
                  #{t.name}
                </button>
              )
            })}
            <form
              className="flex min-h-9 items-center gap-1 rounded-full border border-dashed border-[var(--color-border)] px-2.5 py-1"
              onSubmit={(e) => {
                e.preventDefault()
                createTagAndAssign()
              }}
            >
              <Plus size={12} className="shrink-0 text-[var(--color-muted)]" />
              <input
                value={newTagText}
                onChange={(e) => setNewTagText(e.target.value)}
                placeholder="新建标签"
                aria-label="新建标签"
                className="accent-caret w-20 bg-transparent text-xs outline-none placeholder:text-[var(--color-muted)]"
              />
            </form>
          </div>
        )}

        {/* Description */}
        <div className="mb-2" onClick={(e) => e.stopPropagation()}>
          {editingNote ? (
            <div>
              <textarea
                autoFocus
                value={task.note ?? ''}
                onChange={(e) => updateTask(task.id, { note: e.target.value })}
                onBlur={() => setEditingNote(false)}
                rows={4}
                placeholder="描述"
                className="accent-caret w-full resize-none bg-transparent text-[15px] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)]"
              />
              {(task.note ?? '').trim() && (
                <button
                  type="button"
                  className="mt-1 text-xs text-brand"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setEditingNote(false)}
                >
                  完成
                </button>
              )}
            </div>
          ) : (task.note ?? '').trim() ? (
            <button
              type="button"
              className="md-note max-w-none w-full rounded-lg text-left text-[15px] text-[var(--color-fg)]/90"
              onClick={() => setEditingNote(true)}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.note!}</ReactMarkdown>
            </button>
          ) : (
            <button
              type="button"
              className="min-h-11 w-full text-left text-[15px] text-[var(--color-muted)]"
              onClick={() => setEditingNote(true)}
            >
              描述
            </button>
          )}
        </div>

        {/* Checklist（换行/回车即可添加，右侧排序按钮） */}
        <div onClick={(e) => e.stopPropagation()}>
          <ul>
            {task.checklist.map((c, i) => (
              <li
                key={c.id}
                className={cn(
                  'group flex items-start gap-3 py-3',
                  i > 0 && 'border-t border-[var(--color-border)]',
                )}
              >
                <button
                  type="button"
                  aria-label={c.done ? '取消完成' : '完成检查项'}
                  onClick={() => toggleChecklistItem(task.id, c.id)}
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition',
                    c.done
                      ? 'border-brand bg-brand text-white'
                      : 'border-[var(--color-muted)]/70 text-transparent hover:border-brand',
                  )}
                >
                  <Check size={12} strokeWidth={3} />
                </button>
                <input
                  value={c.text}
                  onChange={(e) =>
                    setChecklist(
                      task.id,
                      task.checklist.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)),
                    )
                  }
                  className={cn(
                    'accent-caret min-w-0 flex-1 bg-transparent text-[15px] outline-none',
                    c.done && 'text-[var(--color-muted)] line-through',
                  )}
                />
                <button
                  type="button"
                  aria-label="删除检查项"
                  className="shrink-0 text-[var(--color-muted)]/50 hover:text-red-500 md:text-[var(--color-muted)] md:opacity-0 md:transition md:group-hover:opacity-100"
                  onClick={() => setChecklist(task.id, task.checklist.filter((x) => x.id !== c.id))}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}

            {/* 常驻添加行：占位符提示「换行即可添加检查事项」 */}
            <li
              className={cn(
                'flex items-center gap-3 py-3',
                task.checklist.length > 0 && 'border-t border-[var(--color-border)]',
              )}
            >
              <button
                type="button"
                aria-label="填写检查项"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border border-[var(--color-border)]"
                onClick={() => checkInputRef.current?.focus()}
              />
              <input
                ref={checkInputRef}
                value={checkText}
                onChange={(e) => setCheckText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitCheck()
                  }
                  if (e.key === 'Escape') setCheckText('')
                }}
                onBlur={() => {
                  if (checkText.trim()) submitCheck()
                }}
                placeholder="换行即可添加检查事项"
                aria-label="新检查项"
                className="accent-caret min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--color-muted)]"
              />
              <button
                type="button"
                aria-label="排序检查项"
                title="已完成项沉底"
                className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--color-muted)]/70 active:opacity-70"
                onClick={sortChecklist}
              >
                <ArrowDownWideNarrow size={16} />
              </button>
            </li>
          </ul>

          {/* Subtasks — only top-level tasks can have children */}
          {isTopLevel && (
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleSubDragEnd}>
              <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <ul>
                  {subtasks.map((s, i) => (
                    <SortableSubtaskRow
                      key={s.id}
                      sub={s}
                      showTopBorder={i > 0 || task.checklist.length > 0}
                      onToggle={() => toggleComplete(s.id)}
                      onOpen={() => setSelectedTaskId(s.id)}
                      onDelete={() => softDelete(s.id)}
                    />
                  ))}

                  {/* Persistent「添加子任务」row — TickTick keeps an empty row at the end */}
                  <li
                    className={cn(
                      'flex items-start gap-3 py-3',
                      (task.checklist.length > 0 || subtasks.length > 0) &&
                        'border-t border-[var(--color-border)]',
                    )}
                  >
                    <button
                      type="button"
                      aria-label="添加子任务"
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-dashed border-[var(--color-muted)]/50 text-transparent"
                      onClick={() => subInputRef.current?.focus()}
                    >
                      <Check size={12} strokeWidth={3.5} />
                    </button>
                    <input
                      ref={subInputRef}
                      value={subText}
                      onChange={(e) => setSubText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          submitSub()
                        }
                        if (e.key === 'Escape') setSubText('')
                      }}
                      onBlur={() => {
                        if (subText.trim()) submitSub()
                      }}
                      placeholder="添加子任务"
                      className="accent-caret min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--color-muted)]"
                    />
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-muted)]/30">
                      <GripVertical size={16} />
                    </span>
                  </li>
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Bottom toolbar — 标签 / 检查项 / 子任务（居中排布，参考滴答清单） */}
      <div
        className="flex shrink-0 items-center justify-center gap-12 border-t border-[var(--color-border)] px-2"
        style={{
          paddingBottom:
            variant === 'sheet'
              ? 'max(8px, env(safe-area-inset-bottom, 0px))'
              : '8px',
          paddingTop: '4px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={cn(
            'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-muted)] active:opacity-70',
            tagsOpen && 'text-brand',
          )}
          aria-label="标签"
          onClick={() => {
            setDateOpen(false)
            setTagsOpen((v) => !v)
          }}
        >
          <TagIcon size={20} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-muted)] active:opacity-70"
          aria-label="添加检查项"
          onClick={() => {
            setTagsOpen(false)
            setDateOpen(false)
            checkInputRef.current?.focus()
          }}
        >
          <ListTodo size={20} strokeWidth={1.75} />
        </button>
        {isTopLevel && (
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-muted)] active:opacity-70"
            aria-label="添加子任务"
            onClick={() => {
              setTagsOpen(false)
              subInputRef.current?.focus()
            }}
          >
            <ListTree size={20} strokeWidth={1.75} />
          </button>
        )}
        {/* Fourth slot intentionally empty — no attachment icon */}
      </div>
    </div>
  )
}
