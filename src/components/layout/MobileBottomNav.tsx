import { useEffect, useRef } from 'react'
import {
  CalendarDays,
  LayoutGrid,
  ListTodo,
  MoreHorizontal,
  Target,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { cn } from '../../lib/cn'
import type { ActiveView } from '../../types'

const TABS = [
  { id: 'tasks' as const, label: '任务', icon: ListTodo },
  { id: 'calendar' as const, label: '日历', icon: CalendarDays },
  { id: 'quadrant' as const, label: '四象限', icon: LayoutGrid },
  { id: 'pomodoro' as const, label: '番茄', icon: Target },
  { id: 'more' as const, label: '更多', icon: MoreHorizontal },
]

function isTaskView(v: ActiveView) {
  return v.kind === 'smart' || v.kind === 'list' || v.kind === 'tag'
}

export function MobileBottomNav() {
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const lastTaskView = useRef<ActiveView>({ kind: 'smart', id: 'today' })

  useEffect(() => {
    if (isTaskView(activeView)) {
      lastTaskView.current = activeView
    }
  }, [activeView])

  const activeTab = (() => {
    if (sidebarOpen) return 'more'
    if (activeView.kind === 'module') {
      if (activeView.id === 'calendar') return 'calendar'
      if (activeView.id === 'quadrant') return 'quadrant'
      if (activeView.id === 'pomodoro') return 'pomodoro'
      if (activeView.id === 'settings' || activeView.id === 'board') return 'more'
    }
    if (isTaskView(activeView)) return 'tasks'
    return 'tasks'
  })()

  const onTab = (id: (typeof TABS)[number]['id']) => {
    if (id === 'more') {
      setSidebarOpen(true)
      return
    }
    setSidebarOpen(false)
    if (id === 'tasks') {
      setActiveView(isTaskView(activeView) ? activeView : lastTaskView.current)
      return
    }
    if (id === 'calendar') setActiveView({ kind: 'module', id: 'calendar' })
    if (id === 'quadrant') setActiveView({ kind: 'module', id: 'quadrant' })
    if (id === 'pomodoro') setActiveView({ kind: 'module', id: 'pomodoro' })
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border)] bg-[var(--color-surface)] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="主导航"
    >
      <div className="flex h-14 items-stretch">
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTab(id)}
              className={cn(
                'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition',
                on
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-[var(--color-muted)]',
              )}
            >
              <Icon size={22} strokeWidth={on ? 2.25 : 1.75} />
              <span className={cn(on && 'font-medium')}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
