import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Ban,
  Check,
  ChevronsUpDown,
  GripVertical,
  ListTodo,
  MoreVertical,
  RotateCcw,
  Tag as TagIcon,
  Trash2,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { PRIORITY_LABELS } from '../../lib/constants'
import { dayjs } from '../../lib/dates'
import { uid } from '../../lib/id'
import { PriorityFlag } from '../common/PriorityFlag'
import type { Priority } from '../../types'
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
  const toggleChecklistItem = useAppStore((s) => s.toggleChecklistItem)
  const setChecklist = useAppStore((s) => s.setChecklist)
  const getSubtasks = useAppStore((s) => s.getSubtasks)

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
  const [addingCheck, setAddingCheck] = useState(false)
  const checkInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setListOpen(false)
    setPriorityOpen(false)
    setMenuOpen(false)
    setTagsOpen(false)
    setDateOpen(false)
    setEditingNote(false)
    setAddingCheck(false)
    setCheckText('')
  }, [selectedTaskId])

  useEffect(() => {
    if (addingCheck) checkInputRef.current?.focus()
  }, [addingCheck])

  if (!task) {
    if (variant === 'sheet') return null
    return (
      <div className="hidden h-full items-center justify-center text-sm text-[var(--color-muted)] lg:flex lg:w-[360px] lg:border-l lg:border-[var(--color-border)] lg:bg-[var(--color-card)]">
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

  const closePopovers = () => {
    setListOpen(false)
    setPriorityOpen(false)
    setMenuOpen(false)
  }

  const submitCheck = () => {
    if (!checkText.trim()) {
      setAddingCheck(false)
      return
    }
    setChecklist(task.id, [
      ...task.checklist,
      { id: uid('cl'), text: checkText.trim(), done: false },
    ])
    setCheckText('')
  }

  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col bg-[var(--color-card)]',
        variant === 'panel' && 'border-l border-[var(--color-border)] lg:w-[380px]',
      )}
      onClick={() => closePopovers()}
    >
      {/* Top bar */}
      <div
        className={cn(
          'relative flex min-h-11 shrink-0 items-center justify-between px-3',
          variant === 'panel' && 'border-b border-[var(--color-border)]',
        )}
        onClick={(e) => e.stopPropagation()}
      >
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
          <div className="absolute left-3 top-11 z-20 max-h-56 w-48 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg">
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
          <div className="absolute right-12 top-11 z-20 w-36 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg">
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
          <div className="absolute right-3 top-11 z-20 w-40 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg">
            {task.status === 'todo' && (
              <>
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
        {/* Date & complete row */}
        <div className="mb-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
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
              'min-h-11 flex-1 text-left text-[15px]',
              task.dueAt || task.remindAt ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]',
            )}
            onClick={() => setDateOpen((v) => !v)}
          >
            {dateLabel}
          </button>
          {progressTotal > 0 && <ProgressRing percent={progressPct} />}
        </div>

        {dateOpen && (
          <div
            className="mb-3 space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
            onClick={(e) => e.stopPropagation()}
          >
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
                className="field-focus mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-2 text-sm"
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
                className="field-focus mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-2 text-sm"
              />
            </label>
            {(task.dueAt || task.remindAt) && (
              <button
                type="button"
                className="text-xs text-brand"
                onClick={() => updateTask(task.id, { dueAt: null, remindAt: null })}
              >
                清除日期与提醒
              </button>
            )}
          </div>
        )}

        {/* Title */}
        <textarea
          value={task.title}
          onChange={(e) => updateTask(task.id, { title: e.target.value })}
          rows={1}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${el.scrollHeight}px`
          }}
          className="accent-caret mb-2 w-full resize-none border-0 bg-transparent text-[22px] font-semibold leading-snug text-[var(--color-fg)] outline-none"
          placeholder="任务标题"
        />

        {/* Description */}
        <div className="mb-4" onClick={(e) => e.stopPropagation()}>
          {editingNote ? (
            <div>
              <textarea
                autoFocus
                value={task.note ?? ''}
                onChange={(e) => updateTask(task.id, { note: e.target.value })}
                onBlur={() => setEditingNote(false)}
                rows={4}
                placeholder="描述"
                className="accent-caret field-focus w-full rounded-xl border border-[var(--color-border)] bg-transparent p-3 text-[15px] text-[var(--color-fg)]"
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
              className="prose prose-sm dark:prose-invert max-w-none w-full rounded-lg text-left text-[15px] text-[var(--color-fg)]/90"
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

        {/* Checklist + subtasks */}
        <div onClick={(e) => e.stopPropagation()}>
          <ul>
            {task.checklist.map((c, i) => (
              <li
                key={c.id}
                className={cn(
                  'flex items-start gap-3 py-3',
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
                      ? 'border-[var(--color-muted)] bg-[var(--color-muted)]/40 text-[var(--color-fg)]'
                      : 'border-[var(--color-muted)]',
                  )}
                >
                  {c.done && <Check size={12} strokeWidth={3} />}
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
                <span className="mt-0.5 text-[var(--color-muted)]/50" aria-hidden>
                  <GripVertical size={16} />
                </span>
              </li>
            ))}

            {isTopLevel &&
              subtasks.map((s, i) => (
                <li
                  key={s.id}
                  className={cn(
                    'flex items-start gap-3 py-3',
                    (task.checklist.length > 0 || i > 0) && 'border-t border-[var(--color-border)]',
                  )}
                >
                  <button
                    type="button"
                    aria-label={s.status === 'done' ? '取消完成' : '完成子任务'}
                    onClick={() => toggleComplete(s.id)}
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition',
                      s.status === 'done'
                        ? 'border-[var(--color-muted)] bg-[var(--color-muted)]/40 text-[var(--color-fg)]'
                        : 'border-[var(--color-muted)]',
                    )}
                  >
                    {s.status === 'done' && <Check size={12} strokeWidth={3} />}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'min-w-0 flex-1 text-left text-[15px]',
                      s.status === 'done' && 'text-[var(--color-muted)] line-through',
                    )}
                    onClick={() => setSelectedTaskId(s.id)}
                  >
                    {s.title}
                  </button>
                  <span className="mt-0.5 text-[var(--color-muted)]/50" aria-hidden>
                    <GripVertical size={16} />
                  </span>
                </li>
              ))}

            {addingCheck && (
              <li
                className={cn(
                  'flex items-center gap-3 py-3',
                  (task.checklist.length > 0 || subtasks.length > 0) &&
                    'border-t border-[var(--color-border)]',
                )}
              >
                <span className="h-5 w-5 shrink-0 rounded-[5px] border border-[var(--color-border)]" />
                <input
                  ref={checkInputRef}
                  value={checkText}
                  onChange={(e) => setCheckText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitCheck()
                    }
                    if (e.key === 'Escape') {
                      setAddingCheck(false)
                      setCheckText('')
                    }
                  }}
                  onBlur={() => {
                    if (checkText.trim()) submitCheck()
                    else setAddingCheck(false)
                  }}
                  placeholder="添加检查项"
                  className="accent-caret min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--color-muted)]"
                />
              </li>
            )}
          </ul>
        </div>

        {/* Tags panel */}
        {tagsOpen && (
          <div
            className="mt-3 flex flex-wrap gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {tags.length === 0 ? (
              <span className="text-xs text-[var(--color-muted)]">暂无标签，可在侧栏添加</span>
            ) : (
              tags.map((t) => {
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
              })
            )}
          </div>
        )}

        {task.tags.length > 0 && !tagsOpen && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {task.tags.map((tid) => {
              const t = tags.find((x) => x.id === tid)
              if (!t) return null
              return (
                <span
                  key={tid}
                  className="rounded-full px-2 py-0.5 text-xs text-white"
                  style={{ background: t.color }}
                >
                  #{t.name}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom toolbar — P0/P1 only: tag + checklist. No attachment. */}
      <div
        className="flex shrink-0 items-center gap-1 border-t border-[var(--color-border)] px-2"
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
            setAddingCheck(true)
          }}
        >
          <ListTodo size={20} strokeWidth={1.75} />
        </button>
        {/* Third slot intentionally empty — no P2 attachment icon */}
      </div>
    </div>
  )
}
