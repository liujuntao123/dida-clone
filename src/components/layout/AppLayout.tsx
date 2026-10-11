import { useEffect, useRef } from 'react'
import { Sidebar } from './Sidebar'
import { MobileBottomNav } from './MobileBottomNav'
import { MobileFab } from './MobileFab'
import { useAppStore } from '../../store/useAppStore'
import { checkDueReminders } from '../../lib/reminders'
import { cn } from '../../lib/cn'
import { applyTheme } from '../../lib/theme'
import { ToastHost } from '../common/Toast'
import { TaskDetailSheet } from '../tasks/TaskDetailSheet'

/** 这些元素是「热点区域」：从它们上面开始的滑动不走「右滑开菜单」手势。 */
const SWIPE_HOTSPOT_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  '.swipeable-list-item', // 任务行的左右滑动（完成/置顶/删除等）
  '.cursor-grab', // 看板 / 四象限可拖拽卡片
  '[data-vaul-overlay]', // 底部抽屉打开时的遮罩
  '[data-vaul-drawer]',
  '[data-no-swipe-menu]',
].join(', ')

function isSwipeHotspot(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(SWIPE_HOTSPOT_SELECTOR) !== null
}

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
    // Note: Notification.requestPermission() is NOT called automatically here —
    // browsers auto-deny permission prompts without a user gesture, which would
    // permanently block reminders. Request it from 设置 → 通知 instead.
    const tick = () => {
      const fired = checkDueReminders(tasks, notified)
      fired.forEach((id) => markReminderNotified(id))
    }
    tick()
    const timer = window.setInterval(tick, 30_000)
    return () => window.clearInterval(timer)
  }, [tasks, notified, markReminderNotified])

  // —— 手势：主区域任意非热点位置右滑 → 打开侧栏菜单 ——
  const contentRef = useRef<HTMLDivElement>(null)
  const menuTouch = useRef<{ x: number; y: number; hotspot: boolean } | null>(null)
  const onMenuTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      menuTouch.current = null
      return
    }
    const t = e.touches[0]
    menuTouch.current = { x: t.clientX, y: t.clientY, hotspot: isSwipeHotspot(e.target) }
  }
  const onMenuTouchEnd = (e: React.TouchEvent) => {
    const start = menuTouch.current
    menuTouch.current = null
    if (!start || start.hotspot || sidebarOpen) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    // 横向为主、位移足够的右滑才算开菜单，避免与纵向滚动打架
    if (dx > 64 && Math.abs(dy) < 56 && dx > Math.abs(dy) * 1.4) {
      setSidebarOpen(true)
    }
  }

  // 横向滑动意图明确时阻止浏览器默认手势（历史导航等）。
  // React 的 onTouchMove 是 passive 的，必须手动挂非 passive 监听。
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onTouchMove = (e: TouchEvent) => {
      const start = menuTouch.current
      if (!start || start.hotspot || sidebarOpen) return
      const t = e.touches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) e.preventDefault()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [sidebarOpen])

  // —— 手势：菜单打开时左滑 → 收起 ——
  const drawerTouch = useRef<{ x: number; y: number } | null>(null)
  const onDrawerTouchStart = (e: React.TouchEvent) => {
    drawerTouch.current =
      e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
  }
  const onDrawerTouchEnd = (e: React.TouchEvent) => {
    const start = drawerTouch.current
    drawerTouch.current = null
    if (!start || !sidebarOpen) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (dx < -64 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      setSidebarOpen(false)
    }
  }

  return (
    <div className="flex h-full bg-[var(--color-surface-2)] text-[var(--color-fg)]">
      {/* Desktop sidebar */}
      <div className="hidden h-full md:flex">{<Sidebar variant="desktop" />}</div>

      {/* Mobile drawer — ~82% width, dimmed main behind. 常驻挂载以支持开合过渡 */}
      <div
        className={cn('fixed inset-0 z-40 md:hidden', !sidebarOpen && 'pointer-events-none')}
        aria-hidden={!sidebarOpen}
        onTouchStart={onDrawerTouchStart}
        onTouchEnd={onDrawerTouchEnd}
        onTouchCancel={() => (drawerTouch.current = null)}
      >
        <button
          type="button"
          className={cn(
            'absolute inset-0 bg-black/55 transition-opacity duration-200',
            sidebarOpen ? 'opacity-100' : 'opacity-0',
          )}
          aria-label="关闭侧栏"
          tabIndex={sidebarOpen ? 0 : -1}
          onClick={() => setSidebarOpen(false)}
        />
        <div
          inert={!sidebarOpen}
          className={cn(
            'absolute inset-y-0 left-0 z-50 w-[82%] max-w-sm shadow-2xl transition-transform duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0.36, 1)' }}
        >
          <Sidebar variant="mobile" />
        </div>
      </div>

      <div
        ref={contentRef}
        className="flex min-w-0 flex-1 flex-col"
        onTouchStart={onMenuTouchStart}
        onTouchEnd={onMenuTouchEnd}
        onTouchCancel={() => (menuTouch.current = null)}
      >
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
