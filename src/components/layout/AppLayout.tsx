import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { MobileBottomNav } from './MobileBottomNav'
import { MobileFab } from './MobileFab'
import { useAppStore } from '../../store/useAppStore'
import { checkDueReminders, ensureNotificationPermission } from '../../lib/reminders'
import { cn } from '../../lib/cn'
import { applyTheme } from '../../lib/theme'
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
    applyTheme(theme)
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
      <div className="hidden h-full md:flex">{<Sidebar variant="desktop" />}</div>

      {/* Mobile drawer — ~82% width, dimmed main behind */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="关闭侧栏"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-50 w-[82%] max-w-sm shadow-2xl">
            <Sidebar variant="mobile" />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <main className={cn('min-h-0 flex-1 overflow-hidden')}>
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
