import { Circle, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { PriorityFlag } from '../common/PriorityFlag'
import { formatDue } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { Task } from '../../types'

export function TaskItem({ task }: { task: Task }) {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const toggleComplete = useAppStore((s) => s.toggleComplete)
  const lists = useAppStore((s) => s.lists)
  const tags = useAppStore((s) => s.tags)
  const list = lists.find((l) => l.id === task.listId)
  const taskTags = tags.filter((t) => task.tags.includes(t.id))
  const done = task.status === 'done'
  const selected = selectedTaskId === task.id

  return (
    <div
      className={cn(
        'group flex cursor-pointer items-start gap-2 border-b border-[var(--color-border)] px-3 py-2.5 transition hover:bg-[var(--color-surface-2)]',
        selected && 'bg-blue-50/60 dark:bg-blue-950/30',
      )}
      onClick={() => setSelectedTaskId(task.id)}
    >
      <button
        type="button"
        className="mt-0.5 shrink-0 text-[var(--color-muted)] hover:text-blue-500"
        onClick={(e) => {
          e.stopPropagation()
          toggleComplete(task.id)
        }}
        aria-label={done ? '取消完成' : '完成'}
      >
        {done ? <CheckCircle2 size={18} className="text-green-500" /> : <Circle size={18} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm', done && 'line-through text-[var(--color-muted)]')}>
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
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
    </div>
  )
}
