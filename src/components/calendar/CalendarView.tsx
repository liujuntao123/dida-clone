import { useCallback, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Square } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { dayjs } from '../../lib/dates'
import { cn } from '../../lib/cn'
import { PriorityFlag } from '../common/PriorityFlag'
import type { Task } from '../../types'
import type { Dayjs } from 'dayjs'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function buildMonthCells(cursor: Dayjs) {
  const start = cursor.startOf('month')
  // Monday-first: day() 0=Sun ... convert
  const startWeekday = (start.day() + 6) % 7
  const gridStart = start.subtract(startWeekday, 'day')
  return Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'))
}

type Dir = 'prev' | 'next'

export function CalendarView() {
  const cursor = useAppStore((s) => s.calendarCursor)
  const setCalendarCursor = useAppStore((s) => s.setCalendarCursor)
  const tasks = useAppStore((s) => s.tasks)
  const lists = useAppStore((s) => s.lists)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const toggleComplete = useAppStore((s) => s.toggleComplete)
  const [selected, setSelected] = useState(() => dayjs())
  const [dir, setDir] = useState<Dir | null>(null)
  const [gridTick, setGridTick] = useState(0)

  const month = dayjs(cursor)
  const cells = useMemo(() => buildMonthCells(month), [month])

  // 待办任务按天分桶（一次遍历，避免每个格子重复过滤全量任务）
  const todoByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (t.status !== 'todo' || !t.dueAt) continue
      const key = dayjs(t.dueAt).format('YYYY-MM-DD')
      const arr = map.get(key)
      if (arr) arr.push(t)
      else map.set(key, [t])
    }
    return map
  }, [tasks])

  const selectedKey = selected.format('YYYY-MM-DD')
  const dayTasks = todoByDay.get(selectedKey) ?? []

  const monthTitle = month.format(month.year() === dayjs().year() ? 'M月' : 'YYYY年M月')
  const selectedLabel = selected.format(selected.year() === dayjs().year() ? 'M月D日 ddd' : 'YYYY年M月D日 ddd')

  /** 切月：光标跟随；选中日不在目标月时平移到同日（ clamp 到月末）。 */
  const changeMonth = useCallback(
    (d: Dir) => {
      const next = d === 'next' ? month.add(1, 'month') : month.subtract(1, 'month')
      setDir(d)
      setCalendarCursor(next.toISOString())
      if (!selected.isSame(next, 'month')) {
        const day = Math.min(selected.date(), next.daysInMonth())
        setSelected(next.date(day))
      }
      setGridTick((v) => v + 1)
    },
    [month, selected, setCalendarCursor],
  )

  const goToday = () => {
    const now = dayjs()
    setDir(now.isBefore(month) ? 'prev' : 'next')
    setCalendarCursor(now.toISOString())
    setSelected(now)
    setGridTick((v) => v + 1)
  }

  // —— 左右滑切换月份 ——
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const onGridTouchStart = (e: React.TouchEvent) => {
    swipe.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
  }
  const onGridTouchEnd = (e: React.TouchEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    // 横向意图明确才切月，避免与纵向滚动打架
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      changeMonth(dx < 0 ? 'next' : 'prev')
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-surface-2)] text-[var(--color-fg)]">
      {/* 头部：大标题 + 今天 / 前后翻月 */}
      <div
        className="flex items-center gap-1 px-3 pb-1"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-bold tracking-tight">{monthTitle}</h1>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-lg px-2.5 text-sm font-medium text-brand active:opacity-70"
          onClick={goToday}
        >
          今天
        </button>
        <button
          type="button"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[var(--color-muted)] active:opacity-70"
          onClick={() => changeMonth('prev')}
          aria-label="上一月"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[var(--color-muted)] active:opacity-70"
          onClick={() => changeMonth('next')}
          aria-label="下一月"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 月历（可左右滑切月；data-no-swipe-menu 避免横滑误触侧栏手势） */}
      <div
        className="px-2 pb-2"
        style={{ touchAction: 'pan-y' }}
        data-no-swipe-menu
        onTouchStart={onGridTouchStart}
        onTouchEnd={onGridTouchEnd}
        onTouchCancel={() => (swipe.current = null)}
      >
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cn(
                'py-1 text-center text-xs font-medium',
                i >= 5 ? 'text-[var(--color-muted)]/70' : 'text-[var(--color-muted)]',
              )}
            >
              {w}
            </div>
          ))}
        </div>
        <div key={gridTick} className={cn('grid grid-cols-7 gap-y-0.5', dir === 'next' && 'animate-month-next', dir === 'prev' && 'animate-month-prev')}>
          {cells.map((d) => {
            const inMonth = d.month() === month.month()
            const isToday = d.isSame(dayjs(), 'day')
            const isSelected = d.isSame(selected, 'day')
            const dayCount = todoByDay.get(d.format('YYYY-MM-DD'))?.length ?? 0
            return (
              <button
                key={d.format('YYYY-MM-DD')}
                type="button"
                onClick={() => {
                  setSelected(d)
                  if (!d.isSame(month, 'month')) setCalendarCursor(d.toISOString())
                }}
                className="flex flex-col items-center py-0.5"
              >
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors',
                    !inMonth && 'text-[var(--color-muted)]/40',
                    inMonth && !isSelected && !isToday && 'text-[var(--color-fg)]',
                    isToday && !isSelected && 'font-semibold text-brand ring-1 ring-inset ring-brand/60',
                    isSelected && 'bg-brand font-semibold text-white shadow-sm shadow-brand/40',
                  )}
                >
                  {d.date()}
                </span>
                <span className="mt-0.5 flex h-1 items-center gap-0.5">
                  {Array.from({ length: Math.min(dayCount, 3) }).map((_, i) => (
                    <span key={i} className={cn('h-1 w-1 rounded-full', isSelected ? 'bg-white/90' : 'bg-brand/80')} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 选中日的任务 */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--color-border)]">
        <div className="flex items-baseline gap-2 px-4 pb-1 pt-3">
          <span className="text-sm font-semibold">{selectedLabel}</span>
          <span className="text-xs text-[var(--color-muted)]">{dayTasks.length > 0 ? `${dayTasks.length} 项` : ''}</span>
        </div>
        {dayTasks.length === 0 ? (
          <div className="flex h-[calc(100%-3rem)] flex-col items-center justify-center gap-3 px-6 pb-16 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--color-card)]">
              <CalendarDays size={40} className="text-[var(--color-muted)]/50" strokeWidth={1.25} />
              <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-brand">
                <ChevronRight size={14} className="text-white" />
              </span>
            </div>
            <p className="text-sm font-medium text-[var(--color-fg)]/90">这一天没有安排</p>
            <p className="text-xs text-[var(--color-muted)]">放松一下吧</p>
          </div>
        ) : (
          <ul className="space-y-1.5 px-3 pb-3 pt-1">
            {dayTasks.map((t) => {
              const list = lists.find((l) => l.id === t.listId)
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-2 rounded-2xl bg-[var(--color-card)] px-2 py-1.5 transition active:bg-[var(--color-surface-2)]"
                >
                  <button
                    type="button"
                    aria-label="完成"
                    className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--color-muted)] hover:text-brand"
                    onClick={() => toggleComplete(t.id)}
                  >
                    <Square size={19} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    className="min-w-0 min-h-11 flex-1 text-left"
                    onClick={() => setSelectedTaskId(t.id)}
                  >
                    <div className="truncate text-sm">{t.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                      <PriorityFlag priority={t.priority} size={11} />
                      <span>{dayjs(t.dueAt).format('HH:mm')}</span>
                      {list && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: list.color }} />
                          <span className="truncate">{list.name}</span>
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
