import { useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { MobileBottomNav } from './MobileBottomNav'
import { MobileFab } from './MobileFab'
import { useAppStore } from '../../store/useAppStore'
import { checkDueReminders, ensureNotificationPermission } from '../../lib/reminders'
import { cn } from '../../lib/cn'
import { ToastHost } from '../common/Toast'
import { TaskDetailSheet } from '../tasks/TaskDetailSheet'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const tasks = useAppStore((s) => s.tasks)
  const notified = useAppStore((s) => s.notifiedReminders)
  const markReminderNotified = useAppStore((s) => s.markReminderNotified)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    void ensureNotificationPermission()
    const tick = () => {
      const fired = checkDueReminders(tasks, notified)
      fired.forEach((id) => markReminderNotified(id))
    }
    tick()
    const timer = window.setInterval(tick, 30_000)
    return () => window.clearInterval(timer)
  }, [tasks, notified, markReminderNotified])

  return (
    <div className="flex h-full bg-[var(--color-surface-2)] text-[var(--color-fg)]">
      {/* Desktop sidebar */}
      <div className="hidden h-full md:flex">{<Sidebar />}</div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="关闭侧栏" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 z-50 shadow-xl">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex min-h-12 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 md:hidden"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))', paddingBottom: '8px' }}
        >
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-[var(--color-surface-2)]"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? '关闭菜单' : '打开菜单'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-semibold text-blue-600">滴答清单</span>
        </header>
        {/* pb for bottom nav on mobile; desktop unchanged */}
        <main className={cn('min-h-0 flex-1 overflow-hidden')}>
          {/* Reserve space for MobileBottomNav (h-14) + safe area; desktop no pad */}
          <div className="h-full pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav />
      <MobileFab />
      <TaskDetailSheet />
      <ToastHost />
    </div>
  )
}
