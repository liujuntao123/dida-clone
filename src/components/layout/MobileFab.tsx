import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Drawer } from 'vaul'
import { useAppStore } from '../../store/useAppStore'
import { dayjs, parseNaturalDate } from '../../lib/dates'
import { cn } from '../../lib/cn'

const FAB_POS_KEY = 'dida-fab-pos'
const FAB_SIZE = 56
const BOTTOM_NAV = 56
const EDGE_GAP = 12
const TOP_MIN = 72

type Side = 'left' | 'right'

interface FabPos {
  side: Side
  top: number
}

function readPos(): FabPos {
  try {
    const raw = localStorage.getItem(FAB_POS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as FabPos
      if ((p.side === 'left' || p.side === 'right') && typeof p.top === 'number') {
        return p
      }
    }
  } catch {
    /* ignore */
  }
  const h = typeof window !== 'undefined' ? window.innerHeight : 700
  return { side: 'right', top: Math.max(TOP_MIN, h - BOTTOM_NAV - FAB_SIZE - 96) }
}

function clampTop(top: number, vh: number) {
  const max = vh - BOTTOM_NAV - FAB_SIZE - EDGE_GAP - 8
  return Math.min(Math.max(top, TOP_MIN), Math.max(TOP_MIN, max))
}

export function MobileFab() {
  const quickAdd = useAppStore((s) => s.quickAdd)
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

  const baseLeft = pos.side === 'left' ? EDGE_GAP : vw - FAB_SIZE - EDGE_GAP

  useEffect(() => {
    const sync = () => {
      setVw(window.innerWidth)
      setVh(window.innerHeight)
      setPos((p) => ({ ...p, top: clampTop(p.top, window.innerHeight) }))
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  const persist = useCallback((next: FabPos) => {
    const clamped = { ...next, top: clampTop(next.top, window.innerHeight) }
    setPos(clamped)
    try {
      localStorage.setItem(FAB_POS_KEY, JSON.stringify(clamped))
    } catch {
      /* ignore */
    }
  }, [])

  const preview = value.trim() ? parseNaturalDate(value) : null

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origTop: pos.top,
      origLeft: baseLeft,
      moved: false,
    }
    setLive({ x: baseLeft, y: pos.top })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) d.moved = true
    setLive({
      x: Math.min(Math.max(d.origLeft + dx, EDGE_GAP), vw - FAB_SIZE - EDGE_GAP),
      y: clampTop(d.origTop + dy, vh),
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
      persist({ side, top: cur.y })
    } else if (!moved) {
      setOpen(true)
    }
  }

  const left = live?.x ?? baseLeft
  const top = live?.y ?? pos.top

  return (
    <>
      <button
        type="button"
        aria-label="添加任务"
        className={cn(
          'fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 md:hidden',
          'active:scale-95 touch-none select-none',
          live && 'scale-105 opacity-95',
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
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 md:hidden" />
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-[var(--color-surface)] outline-none md:hidden"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
          >
            <div className="mx-auto mt-3 mb-2 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
            <Drawer.Title className="px-4 pb-2 text-sm font-medium">快速添加</Drawer.Title>
            <Drawer.Description className="sr-only">输入任务标题，支持自然语言日期</Drawer.Description>
            <form
              className="flex flex-col gap-2 px-4 pb-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!value.trim()) return
                quickAdd(value.trim())
                setValue('')
                setOpen(false)
              }}
            >
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="添加任务，试试「明天 14:00 开会」"
                className="min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-base outline-none focus:border-blue-400"
              />
              {preview?.dueAt && (
                <div className="text-xs text-blue-500">
                  识别日期：{dayjs(preview.dueAt).format('M月D日 HH:mm')}
                  {preview.cleanedTitle !== value.trim() && (
                    <span className="text-[var(--color-muted)]"> · 标题「{preview.cleanedTitle}」</span>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={!value.trim()}
                className="min-h-11 rounded-xl bg-blue-500 text-sm font-medium text-white disabled:opacity-40"
              >
                添加
              </button>
            </form>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}
