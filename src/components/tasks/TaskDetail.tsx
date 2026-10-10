import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Ban,
  CheckSquare,
  Plus,
  Trash2,
  RotateCcw,
  X,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { PRIORITY_LABELS } from '../../lib/constants'
import { dayjs } from '../../lib/dates'
import { uid } from '../../lib/id'
import { PriorityFlag } from '../common/PriorityFlag'
import type { Priority, RepeatRule } from '../../types'
import { cn } from '../../lib/cn'

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
  const addSubtask = useAppStore((s) => s.addSubtask)
  const toggleChecklistItem = useAppStore((s) => s.toggleChecklistItem)
  const setChecklist = useAppStore((s) => s.setChecklist)
  const getSubtasks = useAppStore((s) => s.getSubtasks)

  const task = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId],
  )
  const [subTitle, setSubTitle] = useState('')
  const [checkText, setCheckText] = useState('')
  const [notePreview, setNotePreview] = useState(false)

  if (!task) {
    if (variant === 'sheet') return null
    return (
      <div className="hidden h-full items-center justify-center text-sm text-[var(--color-muted)] lg:flex lg:w-[360px] lg:border-l lg:border-[var(--color-border)] lg:bg-[var(--color-surface)]">
        选择任务查看详情
      </div>
    )
  }

  const subtasks = getSubtasks(task.id)
  const isTopLevel = !task.parentId

  const setDueLocal = (value: string) => {
    updateTask(task.id, { dueAt: value ? dayjs(value).toISOString() : null })
  }
  const setRemindLocal = (value: string) => {
    updateTask(task.id, { remindAt: value ? dayjs(value).toISOString() : null })
  }

  const dueLocal = task.dueAt ? dayjs(task.dueAt).format('YYYY-MM-DDTHH:mm') : ''
  const remindLocal = task.remindAt ? dayjs(task.remindAt).format('YYYY-MM-DDTHH:mm') : ''

  const setRepeat = (value: string) => {
    let repeat: RepeatRule | null = null
    if (value === 'daily') repeat = { type: 'daily' }
    else if (value === 'weekly') repeat = { type: 'weekly' }
    else if (value === 'monthly') repeat = { type: 'monthly' }
    else if (value === 'custom') repeat = { type: 'custom', intervalDays: 3 }
    updateTask(task.id, { repeat })
  }

  const repeatValue =
    !task.repeat ? '' : task.repeat.type === 'custom' ? 'custom' : task.repeat.type

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col bg-[var(--color-surface)]',
        variant === 'panel' && 'border-l border-[var(--color-border)] lg:w-[380px]',
      )}
    >
      <div className="flex min-h-11 items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <span className="text-sm font-medium">任务详情</span>
        <button
          type="button"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-[var(--color-surface-2)]"
          onClick={() => setSelectedTaskId(null)}
          aria-label="关闭详情"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <input
          value={task.title}
          onChange={(e) => updateTask(task.id, { title: e.target.value })}
          className="w-full border-0 bg-transparent text-lg font-medium outline-none"
        />

        <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-sm">
          <span className="text-[var(--color-muted)]">清单</span>
          <select
            value={task.listId}
            onChange={(e) => updateTask(task.id, { listId: e.target.value })}
            className="min-h-11 rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1.5"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          <span className="text-[var(--color-muted)]">优先级</span>
          <div className="flex flex-wrap gap-1">
            {([3, 2, 1, 0] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updateTask(task.id, { priority: p })}
                className={`inline-flex min-h-11 items-center gap-1 rounded-lg border px-2 py-1 text-xs ${
                  task.priority === p ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-[var(--color-border)]'
                }`}
              >
                <PriorityFlag priority={p} size={12} />
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>

          <span className="text-[var(--color-muted)]">日期</span>
          <input
            type="datetime-local"
            value={dueLocal}
            onChange={(e) => setDueLocal(e.target.value)}
            className="min-h-11 rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1.5"
          />

          <span className="text-[var(--color-muted)]">提醒</span>
          <input
            type="datetime-local"
            value={remindLocal}
            onChange={(e) => setRemindLocal(e.target.value)}
            className="min-h-11 rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1.5"
          />

          <span className="text-[var(--color-muted)]">重复</span>
          <select
            value={repeatValue}
            onChange={(e) => setRepeat(e.target.value)}
            className="min-h-11 rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1.5"
          >
            <option value="">不重复</option>
            <option value="daily">每天</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
            <option value="custom">每 3 天</option>
          </select>

          {task.repeat?.type === 'custom' && (
            <>
              <span className="text-[var(--color-muted)]">间隔天数</span>
              <input
                type="number"
                min={1}
                value={task.repeat.intervalDays}
                onChange={(e) =>
                  updateTask(task.id, {
                    repeat: { type: 'custom', intervalDays: Math.max(1, Number(e.target.value) || 1) },
                  })
                }
                className="min-h-11 rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1.5"
              />
            </>
          )}

          <span className="text-[var(--color-muted)]">标签</span>
          <div className="flex flex-wrap gap-1">
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
                  className={`min-h-11 rounded-full px-2 py-0.5 text-xs ${on ? 'text-white' : 'border border-[var(--color-border)]'}`}
                  style={on ? { background: t.color } : undefined}
                >
                  #{t.name}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <CheckSquare size={16} /> 检查事项
          </div>
          <ul className="space-y-1">
            {task.checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={() => toggleChecklistItem(task.id, c.id)}
                />
                <input
                  value={c.text}
                  onChange={(e) =>
                    setChecklist(
                      task.id,
                      task.checklist.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)),
                    )
                  }
                  className={`flex-1 bg-transparent outline-none ${c.done ? 'line-through text-[var(--color-muted)]' : ''}`}
                />
                <button
                  type="button"
                  className="text-[var(--color-muted)] hover:text-red-500"
                  onClick={() =>
                    setChecklist(
                      task.id,
                      task.checklist.filter((x) => x.id !== c.id),
                    )
                  }
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!checkText.trim()) return
              setChecklist(task.id, [
                ...task.checklist,
                { id: uid('cl'), text: checkText.trim(), done: false },
              ])
              setCheckText('')
            }}
          >
            <input
              value={checkText}
              onChange={(e) => setCheckText(e.target.value)}
              placeholder="添加检查项"
              className="min-h-11 flex-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm outline-none"
            />
            <button type="submit" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-blue-500 text-white">
              <Plus size={16} />
            </button>
          </form>
        </div>

        {isTopLevel && (
          <div>
            <div className="mb-2 text-sm font-medium">子任务</div>
            <ul className="space-y-1">
              {subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={s.status === 'done'}
                    onChange={() => toggleComplete(s.id)}
                  />
                  <button
                    type="button"
                    className="flex min-h-11 flex-1 truncate text-left hover:text-blue-600"
                    onClick={() => setSelectedTaskId(s.id)}
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                if (!subTitle.trim()) return
                addSubtask(task.id, subTitle.trim())
                setSubTitle('')
              }}
            >
              <input
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                placeholder="添加子任务"
                className="min-h-11 flex-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm outline-none"
              />
              <button type="submit" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-blue-500 text-white">
                <Plus size={16} />
              </button>
            </form>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">备注</span>
            <button
              type="button"
              className="min-h-11 text-xs text-blue-500"
              onClick={() => setNotePreview((v) => !v)}
            >
              {notePreview ? '编辑' : '预览'}
            </button>
          </div>
          {notePreview ? (
            <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-[var(--color-border)] p-3 text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {task.note || '_暂无备注_'}
              </ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={task.note ?? ''}
              onChange={(e) => updateTask(task.id, { note: e.target.value })}
              rows={6}
              placeholder="支持简单 Markdown…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-transparent p-3 text-sm outline-none"
            />
          )}
        </div>
      </div>

      <div
        className="flex flex-wrap gap-2 border-t border-[var(--color-border)] p-3"
        style={
          variant === 'sheet'
            ? { paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }
            : undefined
        }
      >
        {task.status === 'todo' && (
          <>
            <button type="button" className="min-h-11 rounded-lg bg-green-500 px-3 py-1.5 text-sm text-white" onClick={() => toggleComplete(task.id)}>
              完成
            </button>
            <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm" onClick={() => abandonTask(task.id)}>
              <Ban size={14} /> 放弃
            </button>
            <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600" onClick={() => softDelete(task.id)}>
              <Trash2 size={14} /> 删除
            </button>
          </>
        )}
        {task.status === 'done' && (
          <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3 py-1.5 text-sm" onClick={() => toggleComplete(task.id)}>
            <RotateCcw size={14} /> 恢复未完成
          </button>
        )}
        {(task.status === 'abandoned' || task.status === 'trashed') && (
          <>
            <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3 py-1.5 text-sm" onClick={() => restoreTask(task.id)}>
              <RotateCcw size={14} /> 恢复
            </button>
            {task.status === 'trashed' && (
              <button type="button" className="min-h-11 rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white" onClick={() => permanentlyDelete(task.id)}>
                永久删除
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
