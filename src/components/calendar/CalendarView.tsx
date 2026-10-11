import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Square,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { dayjs } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { Task } from '../../types'
import type { Dayjs } from 'dayjs'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function tasksOnDay(tasks: Task[], day: Dayjs): Task[] {
  const key = day.format('YYYY-MM-DD')
  return tasks.filter((t) => t.status === 'todo' && t.dueAt && dayjs(t.dueAt).format('YYYY-MM-DD') === key)
}

function buildMonthCells(cursor: Dayjs) {
  const start = cursor.startOf('month')
  // Monday-first: day() 0=Sun ... convert
  const startWeekday = (start.day() + 6) % 7
  const gridStart = start.subtract(startWeekday, 'day')
  return Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'))
}

export function CalendarView() {
  const cursor = useAppStore((s) => s.calendarCursor)
  const setCalendarCursor = useAppStore((s) => s.setCalendarCursor)
  const tasks = useAppStore((s) => s.tasks)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const toggleComplete = useAppStore((s) => s.toggleComplete)
  const [selected, setSelected] = useState(() => dayjs())

  const month = dayjs(cursor)
  const todoTasks = useMemo(() => tasks.filter((t) => t.status === 'todo' && !t.parentId), [tasks])
  const cells = useMemo(() => buildMonthCells(month), [month])
  const dayTasks = tasksOnDay(todoTasks, selected)

  const monthTitle = month.format(month.year() === dayjs().year() ? 'M月' : 'YYYY年M月')

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-surface-2)] text-[var(--color-fg)]">
      <div
        className="flex items-center justify-between px-4 pb-2"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">{monthTitle}</h1>
      </div>

      <div className="px-2 pb-2">
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 text-center text-xs text-[var(--color-muted)]">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((d) => {
            const inMonth = d.month() === month.month()
            const isToday = d.isSame(dayjs(), 'day')
            const isSelected = d.isSame(selected, 'day')
            const hasTasks = tasksOnDay(todoTasks, d).length > 0
            return (
              <button
                key={d.format('YYYY-MM-DD')}
                type="button"
                onClick={() => {
                  setSelected(d)
                  if (!d.isSame(month, 'month')) {
                    setCalendarCursor(d.toISOString())
                  }
                }}
                className="flex flex-col items-center py-1"
              >
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-[15px]',
                    !inMonth && 'text-[var(--color-muted)]/40',
                    inMonth && !isSelected && !isToday && 'text-[var(--color-fg)]',
                    isToday && !isSelected && 'font-semibold text-brand',
                    isSelected && 'bg-brand font-semibold text-white',
                  )}
                >
                  {d.date()}
                </span>
                {hasTasks && !isSelected && (
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-brand/80" />
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-1 flex items-center justify-between px-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center text-[var(--color-muted)]"
            onClick={() => setCalendarCursor(month.subtract(1, 'month').toISOString())}
            aria-label="上一月"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="text-xs text-brand"
            onClick={() => {
              const now = dayjs()
              setCalendarCursor(now.toISOString())
              setSelected(now)
            }}
          >
            今天
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center text-[var(--color-muted)]"
            onClick={() => setCalendarCursor(month.add(1, 'month').toISOString())}
            aria-label="下一月"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--color-border)]">
        {dayTasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 pb-20 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-[var(--color-card)]">
              <CalendarDays size={40} className="text-[var(--color-muted)]/50" strokeWidth={1.25} />
              <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-brand">
                <ChevronRight size={14} className="text-white" />
              </span>
            </div>
            <p className="text-base text-[var(--color-fg)]/90">你这一天没有任务</p>
            <p className="text-sm text-[var(--color-muted)]">放松一下吧</p>
          </div>
        ) : (
          <ul className="space-y-1 px-3 py-3">
            {dayTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl bg-[var(--color-card)] px-3 py-3">
                <button
                  type="button"
                  aria-label={t.status === 'done' ? '标为未完成' : '完成'}
                  className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--color-muted)] hover:text-brand"
                  onClick={() => toggleComplete(t.id)}
                >
                  {t.status === 'done' ? <CheckSquare size={20} className="text-brand" /> : <Square size={20} strokeWidth={1.75} />}
                </button>
                <button
                  type="button"
                  className="min-h-11 flex-1 text-left text-[15px]"
                  onClick={() => setSelectedTaskId(t.id)}
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
