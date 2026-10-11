import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { Drawer } from 'vaul'
import { useAppStore } from '../../store/useAppStore'
import { dayjs, parseNaturalDate } from '../../lib/dates'
import { useBackHandler } from '../../lib/backNav'
import { cn } from '../../lib/cn'

/**
 * 可拖动快速添加按钮（移动端）。
 *
 * 定位模型（v3）：记录 { side, gap } —— gap 是「FAB 底边到移动底栏顶边」的距离，
 * 与屏幕高度无关。这样：
 *  - 键盘弹出 / 收起（KeyboardResize.Body，视口高度变化）时 FAB 跟随底栏，
 *    不会像旧的「距顶部 top」模型那样被 resize 钳制后永久错位；
 *  - 位置只在渲染时钳制（clampTop），从不把钳制值写回 localStorage，
 *    瞬时的视口变化不可能污染已保存的位置。
 */
const FAB_POS_KEY = 'dida-fab-pos-v3'
const FAB_SIZE = 56
const BOTTOM_NAV = 56
const EDGE_GAP = 16
const TOP_MIN = 72

type Side = 'left' | 'right'

interface FabPos {
  side: Side
  /** FAB 底边到「底栏区域顶部」（含安全区）的距离，px。 */
  gap: number
}

/** 读取 env(safe-area-inset-bottom) 的实际像素（含 Android 手势条 / 刘海）。 */
let safeBottomCache: number | null = null
function safeAreaBottom(): number {
  if (safeBottomCache != null) return safeBottomCache
  if (typeof document === 'undefined') return 0
  try {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;visibility:hidden;height:env(safe-area-inset-bottom,0px);pointer-events:none;'
    document.body.appendChild(probe)
    safeBottomCache = probe.getBoundingClientRect().height
    probe.remove()
  } catch {
    safeBottomCache = 0
  }
  return safeBottomCache
}

/** 底栏区域总高（导航 56 + 底部安全区）。 */
function navTotal(): number {
  return BOTTOM_NAV + safeAreaBottom()
}

function readPos(): FabPos {
  try {
    const raw = localStorage.getItem(FAB_POS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as FabPos
      if ((p.side === 'left' || p.side === 'right') && typeof p.gap === 'number' && p.gap >= 0) {
        return p
      }
    }
  } catch {
    /* ignore */
  }
  // 默认贴着底栏右下角
  return { side: 'right', gap: EDGE_GAP }
}

/** gap 的合法上限：FAB 顶部不得高于 TOP_MIN。仅在渲染时使用，不回写。 */
function maxGap(vh: number) {
  return Math.max(0, vh - navTotal() - FAB_SIZE - TOP_MIN)
}

function clampGap(gap: number, vh: number) {
  return Math.min(Math.max(gap, 0), maxGap(vh))
}

export function MobileFab() {
  const quickAdd = useAppStore((s) => s.quickAdd)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const activeView = useAppStore((s) => s.activeView)
  const lists = useAppStore((s) => s.lists)
  // 搜索 / 清单 / 标签 / 过滤器 / 设置等工具页不显示 FAB（参考滴答清单）
  const fabHidden =
    sidebarOpen ||
    (activeView.kind === 'module' &&
      ['settings', 'search', 'lists', 'tags', 'filters'].includes(activeView.id))
  // 快速添加的目标清单：清单视图进该清单，其余进收集箱（与 quickAdd 逻辑一致）
  const targetList =
    activeView.kind === 'list'
      ? lists.find((l) => l.id === activeView.id)
      : lists.find((l) => l.isInbox)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 390))
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 700))
  const [pos, setPos] = useState<FabPos>(() => readPos())
  const [live, setLive] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    origTop: number
    origLeft: number
    moved: boolean
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 视口尺寸变化只同步 vh/vw；位置不在这里钳制或回写，
  // 避免键盘等瞬时 resize 把 FAB 永久顶上去（历史 bug）。
  useEffect(() => {
    const sync = () => {
      setVw(window.innerWidth)
      setVh(window.innerHeight)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  const persist = useCallback((next: FabPos) => {
    setPos(next)
    try {
      localStorage.setItem(FAB_POS_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [])

  // —— 位置换算（渲染期钳制：存储值永远保持原样） ——
  const baseGap = clampGap(pos.gap, vh)
  const baseTop = vh - navTotal() - baseGap - FAB_SIZE
  const baseLeft = pos.side === 'left' ? EDGE_GAP : vw - FAB_SIZE - EDGE_GAP

  // Android 返回键：先收起快速添加抽屉
  useBackHandler(open, () => {
    setOpen(false)
    setValue('')
    return true
  })

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origTop: baseTop,
      origLeft: baseLeft,
      moved: false,
    }
    setLive({ x: baseLeft, y: baseTop })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) d.moved = true
    // 拖动范围：顶部不低于 TOP_MIN，底部不没入底栏
    const minY = TOP_MIN
    const maxY = vh - navTotal() - FAB_SIZE - 8
    setLive({
      x: Math.min(Math.max(d.origLeft + dx, EDGE_GAP), vw - FAB_SIZE - EDGE_GAP),
      y: Math.min(Math.max(d.origTop + dy, minY), Math.max(minY, maxY)),
    })
  }

  const finish = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const moved = d.moved
    const cur = live
    drag.current = null
    setLive(null)
    if (moved && cur) {
      const side: Side = cur.x + FAB_SIZE / 2 < vw / 2 ? 'left' : 'right'
      // 换算回 gap（相对底栏顶部，不受当前 vh 影响），钳制到合法区间后存储
      const gap = clampGap(vh - navTotal() - cur.y - FAB_SIZE, vh)
      persist({ side, gap })
    } else if (!moved) {
      setOpen(true)
    }
  }

  const left = live?.x ?? baseLeft
  const top = live?.y ?? baseTop

  const preview = value.trim() ? parseNaturalDate(value) : null

  const submit = () => {
    if (!value.trim()) return
    quickAdd(value.trim())
    setValue('')
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        aria-label="添加任务"
        className={cn(
          'fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/35 md:hidden',
          'active:scale-95 touch-none select-none',
          live && 'scale-105 opacity-95',
          fabHidden && 'pointer-events-none opacity-0',
        )}
        style={{
          left,
          top,
          transition: live ? 'none' : 'left 0.2s ease, top 0.15s ease',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      <Drawer.Root
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setValue('')
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[60vh] flex-col rounded-t-[20px] bg-[var(--color-card)] outline-none md:hidden"
            style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))' }}
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
          >
            <div className="mx-auto mt-2.5 mb-1 h-1 w-9 shrink-0 rounded-full bg-[var(--color-muted)]/35" />
            <Drawer.Title className="sr-only">快速添加</Drawer.Title>
            <Drawer.Description className="sr-only">输入要做的事</Drawer.Description>
            <form
              className="flex min-w-0 flex-col px-4 pb-2 pt-1"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="准备做什么？试试「明天 14:00 开会」"
                enterKeyHint="done"
                className="accent-caret min-h-12 w-full bg-transparent text-[17px] font-medium text-[var(--color-fg)] outline-none placeholder:font-normal placeholder:text-[var(--color-muted)]"
              />
              {preview?.dueAt && (
                <div className="flex flex-wrap items-center gap-1.5 pb-1 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-1 font-medium text-brand">
                    <CalendarDays size={13} strokeWidth={2} />
                    识别日期：{dayjs(preview.dueAt).format('M月D日 HH:mm')}
                  </span>
                  {preview.cleanedTitle !== value.trim() && (
                    <span className="text-[var(--color-muted)]">标题「{preview.cleanedTitle}」</span>
                  )}
                </div>
              )}
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-[var(--color-muted)]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: targetList?.color ?? 'var(--color-muted)' }}
                  />
                  <span className="truncate">添加到「{targetList?.name ?? '收集箱'}」</span>
                </span>
                <button
                  type="submit"
                  disabled={!value.trim()}
                  className="btn-primary h-10 shrink-0 px-5 text-[15px]"
                >
                  <Plus size={17} strokeWidth={2.5} />
                  添加
                </button>
              </div>
            </form>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}
