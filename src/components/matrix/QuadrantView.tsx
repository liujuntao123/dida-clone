import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useState } from 'react'
import { MoreVertical, Square, CheckSquare, List } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { Priority, Task } from '../../types'
import { cn } from '../../lib/cn'

/**
 * Eisenhower by priority:
 * 高(3) → I 重要且紧急
 * 中(2) → II 重要不紧急
 * 低(1) → III 不重要但紧急
 * 无(0) → IV 不重要不紧急
 */
const QUADRANTS: {
  id: string
  roman: string
  title: string
  priority: Priority
  labelClass: string
  badgeClass: string
}[] = [
  {
    id: 'q1',
    roman: 'I',
    title: '重要且紧急',
    priority: 3,
    labelClass: 'text-red-400',
    badgeClass: 'bg-red-500/90 text-white',
  },
  {
    id: 'q2',
    roman: 'II',
    title: '重要不紧急',
    priority: 2,
    labelClass: 'text-amber-400',
    badgeClass: 'bg-amber-400/90 text-black',
  },
  {
    id: 'q3',
    roman: 'III',
    title: '不重要但紧急',
    priority: 1,
    labelClass: 'text-sky-400',
    badgeClass: 'bg-sky-500/90 text-white',
  },
  {
    id: 'q4',
    roman: 'IV',
    title: '不重要不紧急',
    priority: 0,
    labelClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/90 text-white',
  },
]

function Card({ task, listName }: { task: Task; listName?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const toggleComplete = useAppStore((s) => s.toggleComplete)
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 }
    : { opacity: isDragging ? 0.4 : 1 }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-2 cursor-grab rounded-lg px-1 py-1.5 active:cursor-grabbing"
      onClick={() => setSelectedTaskId(task.id)}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 text-[var(--color-muted)]"
          onClick={(e) => {
            e.stopPropagation()
            toggleComplete(task.id)
          }}
        >
          {task.status === 'done' ? (
            <CheckSquare size={18} className="text-brand" />
          ) : (
            <Square size={18} strokeWidth={1.75} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] leading-snug text-[var(--color-fg)]">{task.title}</div>
          {listName && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
              <List size={11} />
              {listName}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Quad({
  q,
  tasks,
  lists,
}: {
  q: (typeof QUADRANTS)[number]
  tasks: Task[]
  lists: { id: string; name: string }[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: q.id })
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? tasks : tasks.slice(0, 4)
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[42vw] flex-col rounded-2xl bg-[var(--color-card)] p-3 md:min-h-64',
        isOver && 'ring-2 ring-brand/60',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold', q.badgeClass)}>
          {q.roman}
        </span>
        <span className={cn('text-[13px] font-medium', q.labelClass)}>{q.title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex h-full min-h-16 items-center justify-center text-sm text-[var(--color-muted)]">没有任务</div>
        ) : (
          <>
            {visible.map((t) => (
              <Card key={t.id} task={t} listName={lists.find((l) => l.id === t.listId)?.name} />
            ))}
            {tasks.length > 4 && !expanded && (
              <button
                type="button"
                className="w-full py-1 text-center text-xs text-[var(--color-muted)]"
                onClick={() => setExpanded(true)}
              >
                查看更多
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function QuadrantView() {
  const tasks = useAppStore((s) => s.tasks)
  const lists = useAppStore((s) => s.lists)
  const setTaskPriority = useAppStore((s) => s.setTaskPriority)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const base = tasks.filter((t) => t.status === 'todo' && !t.parentId)
  const activeTask = base.find((t) => t.id === activeId)

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    let target = String(over.id)
    if (!QUADRANTS.some((q) => q.id === target)) {
      const task = base.find((t) => t.id === target)
      if (task) {
        const q = QUADRANTS.find((x) => x.priority === task.priority)
        target = q?.id ?? target
      }
    }
    const q = QUADRANTS.find((x) => x.id === target)
    if (q) setTaskPriority(String(active.id), q.priority)
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface-2)] text-[var(--color-fg)] dark:bg-black dark:text-white">
      <div
        className="flex items-center justify-between px-4 pb-2"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <h1 className="text-xl font-semibold">四象限</h1>
        <button type="button" className="flex h-10 w-10 items-center justify-center text-[var(--color-muted)]" aria-label="更多">
          <MoreVertical size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-4">
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
        >
          <div className="grid grid-cols-2 gap-2">
            {QUADRANTS.map((q) => (
              <Quad
                key={q.id}
                q={q}
                tasks={base.filter((t) => t.priority === q.priority)}
                lists={lists}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="rounded-lg bg-[var(--color-card)] px-3 py-2 text-sm shadow-lg">{activeTask.title}</div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
