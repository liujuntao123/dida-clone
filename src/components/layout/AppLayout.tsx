import { useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useAppStore } from '../../store/useAppStore'
import { checkDueReminders, ensureNotificationPermission } from '../../lib/reminders'
import { cn } from '../../lib/cn'

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
      <div className="hidden md:flex">{<Sidebar />}</div>

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
        <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 md:hidden">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-[var(--color-surface-2)]"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-semibold text-blue-600">滴答清单</span>
        </header>
        <main className={cn('min-h-0 flex-1 overflow-hidden')}>{children}</main>
      </div>
    </div>
  )
}
