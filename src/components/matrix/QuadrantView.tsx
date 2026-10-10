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
import { useAppStore } from '../../store/useAppStore'
import type { Priority, Task } from '../../types'
import { cn } from '../../lib/cn'

/**
 * Simplified Eisenhower mapping by priority:
 * 高(3) → 重要且紧急
 * 中(2) → 重要不紧急
 * 低(1) → 不重要但紧急
 * 无(0) → 不重要不紧急
 */
const QUADRANTS: { id: string; title: string; subtitle: string; priority: Priority; color: string }[] = [
  { id: 'q1', title: '重要且紧急', subtitle: '高优先级', priority: 3, color: 'bg-red-50 dark:bg-red-950/30 border-red-200' },
  { id: 'q2', title: '重要不紧急', subtitle: '中优先级', priority: 2, color: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200' },
  { id: 'q3', title: '不重要但紧急', subtitle: '低优先级', priority: 1, color: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200' },
  { id: 'q4', title: '不重要不紧急', subtitle: '无优先级', priority: 0, color: 'bg-slate-50 dark:bg-slate-900/40 border-slate-200' },
]

function Card({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 }
    : { opacity: isDragging ? 0.4 : 1 }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-2 cursor-grab rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-sm"
      onClick={() => setSelectedTaskId(task.id)}
    >
      {task.title}
    </div>
  )
}

function Quad({
  q,
  tasks,
}: {
  q: (typeof QUADRANTS)[number]
  tasks: Task[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: q.id })
  return (
    <div
      ref={setNodeRef}
      className={cn('flex min-h-64 flex-col rounded-xl border p-3', q.color, isOver && 'ring-2 ring-blue-400')}
    >
      <div className="mb-2">
        <div className="font-semibold text-sm">{q.title}</div>
        <div className="text-xs text-[var(--color-muted)]">{q.subtitle}</div>
      </div>
      <div className="flex-1">
        {tasks.map((t) => (
          <Card key={t.id} task={t} />
        ))}
      </div>
    </div>
  )
}

export function QuadrantView() {
  const tasks = useAppStore((s) => s.tasks)
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
    <div className="flex h-full flex-col bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h1 className="text-lg font-semibold">四象限</h1>
        <p className="text-xs text-[var(--color-muted)]">拖拽任务到其他象限可更改优先级</p>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
        >
          <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2">
            {QUADRANTS.map((q) => (
              <Quad key={q.id} q={q} tasks={base.filter((t) => t.priority === q.priority)} />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="rounded-lg border bg-[var(--color-surface)] px-3 py-2 shadow-lg">{activeTask.title}</div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
