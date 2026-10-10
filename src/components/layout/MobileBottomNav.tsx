import { useEffect, useRef } from 'react'
import { Clock, LayoutGrid, ListTodo, MoreHorizontal } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { dayjs } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { ActiveView } from '../../types'

const todayNum = () => dayjs().date()

function CalendarTabIcon({ active }: { active: boolean }) {
  const n = todayNum()
  return (
    <span
      className={cn(
        'relative flex h-[22px] w-[22px] items-center justify-center rounded-[5px] border-2 text-[10px] font-semibold leading-none',
        active ? 'border-[#FF7A45] text-[#FF7A45]' : 'border-current text-current',
      )}
      aria-hidden
    >
      <span className="absolute -top-0.5 left-1/2 h-0.5 w-2 -translate-x-1/2 rounded-full bg-current opacity-70" />
      {n}
    </span>
  )
}

const TABS = [
  { id: 'tasks' as const, label: '任务', icon: 'tasks' },
  { id: 'habits' as const, label: '习惯', icon: 'habits' },
  { id: 'calendar' as const, label: '日历', icon: 'calendar' },
  { id: 'quadrant' as const, label: '四象限', icon: 'quadrant' },
  { id: 'more' as const, label: '更多', icon: 'more' },
]

function isTaskView(v: ActiveView) {
  return v.kind === 'smart' || v.kind === 'list' || v.kind === 'tag'
}

export function MobileBottomNav() {
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const lastTaskView = useRef<ActiveView>({ kind: 'smart', id: 'all' })

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
      if (activeView.id === 'habits') return 'habits'
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
    if (id === 'habits') setActiveView({ kind: 'module', id: 'habits' })
    if (id === 'calendar') setActiveView({ kind: 'module', id: 'calendar' })
    if (id === 'quadrant') setActiveView({ kind: 'module', id: 'quadrant' })
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#2C2C2E] bg-black md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="主导航"
    >
      <div className="flex h-14 items-stretch">
        {TABS.map(({ id, label }) => {
          const on = activeTab === id
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-current={on ? 'page' : undefined}
              onClick={() => onTab(id)}
              className={cn(
                'flex min-h-11 flex-1 items-center justify-center transition',
                on ? 'text-[#FF7A45]' : 'text-[#8E8E93]',
              )}
            >
              {id === 'tasks' && <ListTodo size={24} strokeWidth={on ? 2.25 : 1.75} />}
              {id === 'habits' && <Clock size={24} strokeWidth={on ? 2.25 : 1.75} />}
              {id === 'calendar' && <CalendarTabIcon active={on} />}
              {id === 'quadrant' && <LayoutGrid size={24} strokeWidth={on ? 2.25 : 1.75} />}
              {id === 'more' && <MoreHorizontal size={24} strokeWidth={on ? 2.25 : 1.75} />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
