import { useMemo, useState } from 'react'
import { DayPicker, type DayButtonProps } from 'react-day-picker'
import { zhCN } from 'react-day-picker/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { dayjs, startOfWeek } from '../../lib/dates'
import { PRIORITY_COLORS } from '../../lib/constants'
import { cn } from '../../lib/cn'
import type { Task } from '../../types'

function tasksOnDay(tasks: Task[], day: Date): Task[] {
  const key = dayjs(day).format('YYYY-MM-DD')
  return tasks.filter((t) => t.status === 'todo' && t.dueAt && dayjs(t.dueAt).format('YYYY-MM-DD') === key)
}

export function CalendarView() {
  const mode = useAppStore((s) => s.calendarMode)
  const setCalendarMode = useAppStore((s) => s.setCalendarMode)
  const cursor = useAppStore((s) => s.calendarCursor)
  const setCalendarCursor = useAppStore((s) => s.setCalendarCursor)
  const tasks = useAppStore((s) => s.tasks)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const [selected, setSelected] = useState<Date>(dayjs(cursor).toDate())

  const todoTasks = useMemo(() => tasks.filter((t) => t.status === 'todo' && !t.parentId), [tasks])

  const weekStart = startOfWeek(dayjs(selected))
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))

  const DayButton = (props: DayButtonProps) => {
    const { day, modifiers, ...buttonProps } = props
    const dayTasks = tasksOnDay(todoTasks, day.date)
    return (
      <button {...buttonProps} type="button" className={cn(buttonProps.className, 'relative min-h-16 w-full flex-col items-start p-1')}>
        <span className={cn('text-xs', modifiers.today && 'font-bold text-blue-600')}>
          {day.date.getDate()}
        </span>
        <div className="mt-0.5 flex w-full flex-col gap-0.5 overflow-hidden">
          {dayTasks.slice(0, 3).map((t) => (
            <span
              key={t.id}
              className="truncate rounded px-0.5 text-[10px] text-white"
              style={{ background: PRIORITY_COLORS[t.priority] === '#9ca3af' ? '#3b82f6' : PRIORITY_COLORS[t.priority] }}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedTaskId(t.id)
                setActiveView({ kind: 'smart', id: 'all' })
              }}
            >
              {t.title}
            </span>
          ))}
          {dayTasks.length > 3 && (
            <span className="text-[10px] text-[var(--color-muted)]">+{dayTasks.length - 3}</span>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h1 className="text-lg font-semibold">日历</h1>
        <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-0.5 text-sm">
          <button
            type="button"
            className={cn('rounded-md px-3 py-1', mode === 'month' && 'bg-blue-500 text-white')}
            onClick={() => setCalendarMode('month')}
          >
            月
          </button>
          <button
            type="button"
            className={cn('rounded-md px-3 py-1', mode === 'week' && 'bg-blue-500 text-white')}
            onClick={() => setCalendarMode('week')}
          >
            周
          </button>
        </div>
      </div>

      {mode === 'month' ? (
        <div className="flex-1 overflow-auto p-4">
          <DayPicker
            mode="single"
            locale={zhCN}
            month={dayjs(cursor).toDate()}
            onMonthChange={(m) => setCalendarCursor(dayjs(m).toISOString())}
            selected={selected}
            onSelect={(d) => d && setSelected(d)}
            showOutsideDays
            className="w-full"
            classNames={{
              month_grid: 'w-full',
              weekdays: 'flex w-full',
              weekday: 'flex-1 text-center text-xs text-[var(--color-muted)] py-2',
              weeks: 'w-full',
              week: 'flex w-full min-h-20 border-t border-[var(--color-border)]',
              day: 'flex-1 border-r border-[var(--color-border)] last:border-r-0',
            }}
            components={{ DayButton }}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="flex items-center justify-between px-4 py-2">
            <button
              type="button"
              className="rounded p-1 hover:bg-[var(--color-surface-2)]"
              onClick={() => setSelected(dayjs(selected).subtract(1, 'week').toDate())}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium">
              {weekStart.format('M月D日')} – {weekStart.add(6, 'day').format('M月D日')}
            </span>
            <button
              type="button"
              className="rounded p-1 hover:bg-[var(--color-surface-2)]"
              onClick={() => setSelected(dayjs(selected).add(1, 'week').toDate())}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid flex-1 grid-cols-7 gap-px border-t border-[var(--color-border)] bg-[var(--color-border)]">
            {weekDays.map((d) => {
              const dayTasks = tasksOnDay(todoTasks, d.toDate())
              return (
                <div key={d.format('YYYY-MM-DD')} className="min-h-48 bg-[var(--color-surface)] p-2">
                  <div className={cn('mb-2 text-center text-sm', d.isSame(dayjs(), 'day') && 'font-bold text-blue-600')}>
                    <div className="text-xs text-[var(--color-muted)]">{d.format('ddd')}</div>
                    {d.format('D')}
                  </div>
                  <div className="space-y-1">
                    {dayTasks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="block w-full truncate rounded px-1.5 py-1 text-left text-xs text-white"
                        style={{ background: PRIORITY_COLORS[t.priority] === '#9ca3af' ? '#3b82f6' : PRIORITY_COLORS[t.priority] }}
                        onClick={() => {
                          setSelectedTaskId(t.id)
                          setActiveView({ kind: 'smart', id: 'all' })
                        }}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
