import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Check, GripVertical, MoreVertical } from 'lucide-react'
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
    badgeClass: 'bg-red-500 text-white',
  },
  {
    id: 'q2',
    roman: 'II',
    title: '重要不紧急',
    priority: 2,
    labelClass: 'text-amber-400',
    badgeClass: 'bg-amber-400 text-black',
  },
  {
    id: 'q3',
    roman: 'III',
    title: '不重要但紧急',
    priority: 1,
    labelClass: 'text-sky-400',
    badgeClass: 'bg-sky-500 text-white',
  },
  {
    id: 'q4',
    roman: 'IV',
    title: '不重要不紧急',
    priority: 0,
    labelClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500 text-white',
  },
]

/** 折叠时每象限最多展示的任务数，超出显示「查看更多」。 */
const COLLAPSED_COUNT = 8

function QuadTaskRow({
  task,
  draggable,
  onOpen,
}: {
  task: Task
  draggable: boolean
  onOpen: () => void
}) {
  const toggleComplete = useAppStore((s) => s.toggleComplete)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !draggable })
  const done = task.status === 'done'

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-lg px-1 py-1.5 transition',
        isDragging && 'opacity-30',
      )}
    >
      <button
        type="button"
        aria-label={done ? '标为未完成' : '完成'}
        onClick={() => toggleComplete(task.id)}
        className={cn(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition',
          done
            ? 'border-transparent bg-[var(--color-muted)]/60 text-[var(--color-card)]'
            : 'border-[var(--color-muted)]/70 text-transparent hover:border-brand',
        )}
      >
        <Check size={11} strokeWidth={3.5} />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'min-w-0 flex-1 text-left text-[14px] leading-snug',
          done ? 'text-[var(--color-muted)]' : 'text-[var(--color-fg)]',
        )}
      >
        {task.title}
      </button>
      {draggable && (
        <button
          type="button"
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          onPointerDown={(e) => {
            e.stopPropagation()
            listeners?.onPointerDown?.(e)
          }}
          aria-label="拖动调整优先级"
          className="-mr-1 mt-0.5 flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-[var(--color-muted)]/50 active:cursor-grabbing active:text-brand"
        >
          <GripVertical size={14} />
        </button>
      )}
    </div>
  )
}

function Quad({
  q,
  todoTasks,
  doneTasks,
  dragActive,
  showDone,
  onOpenTask,
}: {
  q: (typeof QUADRANTS)[number]
  todoTasks: Task[]
  doneTasks: Task[]
  dragActive: boolean
  showDone: boolean
  onOpenTask: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: q.id })
  const [expanded, setExpanded] = useState(false)

  const doneVisible = showDone ? doneTasks : []
  const all = [...todoTasks, ...doneVisible]
  const visible = expanded ? all : all.slice(0, COLLAPSED_COUNT)
  const hiddenCount = all.length - visible.length

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-2xl bg-[var(--color-card)] p-3 transition',
        dragActive && !isOver && 'opacity-80',
        isOver && dragActive && 'ring-2 ring-brand bg-brand/5',
      )}
    >
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <span
          className={cn(
            'flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-0.5 text-[11px] font-bold leading-none',
            q.badgeClass,
          )}
        >
          {q.roman}
        </span>
        <span className={cn('truncate text-[14px] font-medium', q.labelClass)}>{q.title}</span>
        <span className="tnum ml-auto shrink-0 text-xs text-[var(--color-muted)]">{todoTasks.length || ''}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {all.length === 0 ? (
          <div className="flex h-full min-h-20 items-center justify-center text-[14px] text-[var(--color-muted)]/80">
            没有任务
          </div>
        ) : (
          <>
            {visible.map((t) => (
              <QuadTaskRow key={t.id} task={t} draggable={t.status === 'todo'} onOpen={() => onOpenTask(t.id)} />
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                className="w-full py-1.5 text-center text-xs text-[var(--color-muted)] active:opacity-70"
                onClick={() => setExpanded(true)}
              >
                查看更多 ({hiddenCount})
              </button>
            )}
            {expanded && all.length > COLLAPSED_COUNT && (
              <button
                type="button"
                className="w-full py-1.5 text-center text-xs text-[var(--color-muted)] active:opacity-70"
                onClick={() => setExpanded(false)}
              >
                收起
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
  const setTaskPriority = useAppStore((s) => s.setTaskPriority)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDone, setShowDone] = useState(true)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const todo = useMemo(() => tasks.filter((t) => t.status === 'todo' && !t.parentId), [tasks])
  const done = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'done' && !t.parentId)
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    [tasks],
  )
  const activeTask = [...todo, ...done].find((t) => t.id === activeId)

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const target = QUADRANTS.find((q) => q.id === String(over.id))
    const task = tasks.find((t) => t.id === String(active.id))
    if (target && task && task.priority !== target.priority) {
      setTaskPriority(task.id, target.priority)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface-2)] text-[var(--color-fg)]">
      {/* Header：标题 + 更多菜单 */}
      <div
        className="relative flex min-h-12 shrink-0 items-center justify-between px-4"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <h1 className="text-[20px] font-bold tracking-tight">四象限</h1>
        <button
          type="button"
          aria-label="更多"
          className="flex min-h-11 min-w-11 items-center justify-center text-[var(--color-fg)]/85 active:opacity-70"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreVertical size={20} />
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30 cursor-default"
              aria-label="关闭菜单"
              onClick={() => setMenuOpen(false)}
            />
            <div className="animate-fade-in absolute right-3 top-12 z-40 w-56 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg">
              <div className="px-3 py-2 text-xs leading-relaxed text-[var(--color-muted)]">
                拖动任务右侧的把手到其他象限，即可调整优先级。
              </div>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm active:bg-[var(--color-surface-2)]"
                onClick={() => setShowDone((v) => !v)}
              >
                显示已完成
                <span
                  className={cn(
                    'relative h-5 w-9 rounded-full transition',
                    showDone ? 'bg-brand' : 'bg-[var(--color-muted)]/40',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
                      showDone ? 'left-[18px]' : 'left-0.5',
                    )}
                  />
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* 全屏 2×2 */}
      <div className="min-h-0 flex-1 px-2 pb-2">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-2">
            {QUADRANTS.map((q) => (
              <Quad
                key={q.id}
                q={q}
                todoTasks={todo.filter((t) => t.priority === q.priority)}
                doneTasks={done.filter((t) => t.priority === q.priority)}
                dragActive={!!activeId}
                showDone={showDone}
                onOpenTask={setSelectedTaskId}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <div
                className="rotate-1 rounded-xl bg-[var(--color-card)] px-3 py-2.5 text-[14px] text-[var(--color-fg)] shadow-xl ring-2 ring-brand/70"
                style={{ width: 176 }}
              >
                <div className="line-clamp-2">{activeTask.title}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
