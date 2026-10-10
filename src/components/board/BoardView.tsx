import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { PRIORITY_LABELS, PRIORITY_COLORS } from '../../lib/constants'
import { formatDue } from '../../lib/dates'
import type { Priority, Task } from '../../types'
import { cn } from '../../lib/cn'

type ColumnDef = { id: string; title: string; match: (t: Task) => boolean; onDrop: (taskId: string) => void }

function SortableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-2 cursor-grab rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm active:cursor-grabbing active:opacity-90"
      onClick={() => setSelectedTaskId(task.id)}
    >
      <div className="text-sm font-medium">{task.title}</div>
      {task.dueAt && <div className="mt-1 text-xs text-[var(--color-muted)]">{formatDue(task.dueAt)}</div>}
    </div>
  )
}

function Column({ col, tasks }: { col: ColumnDef; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-2xl bg-[var(--color-card)] p-3',
        isOver && 'ring-2 ring-brand/70',
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">{col.title}</h3>
        <span className="rounded-full bg-[var(--color-surface-2)] px-2 text-xs text-[var(--color-muted)] dark:bg-black/40">
          {tasks.length}
        </span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-24 flex-1">
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

export function BoardView() {
  const tasks = useAppStore((s) => s.tasks)
  const boardGroupBy = useAppStore((s) => s.boardGroupBy)
  const setBoardGroupBy = useAppStore((s) => s.setBoardGroupBy)
  const setTaskPriority = useAppStore((s) => s.setTaskPriority)
  const updateTask = useAppStore((s) => s.updateTask)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const columns: ColumnDef[] = useMemo(() => {
    if (boardGroupBy === 'priority') {
      return ([3, 2, 1, 0] as Priority[]).map((p) => ({
        id: `pri-${p}`,
        title: `优先级 · ${PRIORITY_LABELS[p]}`,
        match: (t: Task) => t.priority === p,
        onDrop: (taskId: string) => setTaskPriority(taskId, p),
      }))
    }
    return [
      {
        id: 'st-todo',
        title: '待办',
        match: (t: Task) => t.status === 'todo',
        onDrop: (taskId: string) => updateTask(taskId, { status: 'todo', completedAt: null }),
      },
      {
        id: 'st-done',
        title: '已完成',
        match: (t: Task) => t.status === 'done',
        onDrop: (taskId: string) =>
          updateTask(taskId, { status: 'done', completedAt: new Date().toISOString() }),
      },
      {
        id: 'st-abandoned',
        title: '已放弃',
        match: (t: Task) => t.status === 'abandoned',
        onDrop: (taskId: string) => updateTask(taskId, { status: 'abandoned' }),
      },
    ]
  }, [boardGroupBy, setTaskPriority, updateTask])

  const base = tasks.filter((t) => !t.parentId && t.status !== 'trashed')
  const activeTask = base.find((t) => t.id === activeId)

  const findColumnOf = (taskId: string) =>
    columns.find((c) => c.match(base.find((t) => t.id === taskId)!))

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const taskId = String(active.id)
    let colId = String(over.id)
    // dropped on a card → find that card's column
    if (!columns.some((c) => c.id === colId)) {
      const overCol = findColumnOf(colId)
      colId = overCol?.id ?? colId
    }
    const col = columns.find((c) => c.id === colId)
    col?.onDrop(taskId)
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface-2)]">
      <div className="flex min-h-12 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <h1 className="text-lg font-semibold">看板</h1>
        <select
          value={boardGroupBy}
          onChange={(e) => setBoardGroupBy(e.target.value as 'priority' | 'status')}
          className="field-focus min-h-11 rounded-xl border border-[var(--color-border)] bg-transparent px-2.5 py-1.5 text-sm"
        >
          <option value="priority">按优先级</option>
          <option value="status">按状态</option>
        </select>
      </div>
      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          {columns.map((col) => (
            <Column key={col.id} col={col} tasks={base.filter(col.match)} />
          ))}
          <DragOverlay>
            {activeTask ? (
              <div className="w-72 rounded-xl border border-brand/40 bg-[var(--color-card)] p-3 shadow-lg">
                {activeTask.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
