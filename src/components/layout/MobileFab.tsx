import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  Flag,
  Inbox,
  Mic,
  MoreHorizontal,
  Plus,
  Tag,
} from 'lucide-react'
import { Drawer } from 'vaul'
import { useAppStore } from '../../store/useAppStore'
import { dayjs, parseNaturalDate } from '../../lib/dates'
import { cn } from '../../lib/cn'

const FAB_POS_KEY = 'dida-fab-pos'
const FAB_SIZE = 56
const BOTTOM_NAV = 56
const EDGE_GAP = 16
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
          'fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF7A45] text-white shadow-lg shadow-[#FF7A45]/35 md:hidden',
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
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[55vh] flex-col rounded-t-2xl bg-[#1C1C1E] outline-none md:hidden"
            style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))' }}
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
          >
            <div className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-white/20" />
            <Drawer.Title className="sr-only">快速添加</Drawer.Title>
            <Drawer.Description className="sr-only">输入要做的事</Drawer.Description>
            <form
              className="flex flex-col gap-1 px-4 pb-3 pt-1"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="准备做什么？"
                className="accent-caret min-h-12 w-full bg-transparent text-[17px] text-white outline-none placeholder:text-[#8E8E93]"
              />
              {preview?.dueAt && (
                <div className="text-xs text-[#FF7A45]">
                  识别日期：{dayjs(preview.dueAt).format('M月D日 HH:mm')}
                </div>
              )}
              <div className="mt-1 flex items-center gap-1 text-[#8E8E93]">
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/5" aria-label="日期">
                  <CalendarDays size={20} strokeWidth={1.75} />
                </button>
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/5" aria-label="优先级">
                  <Flag size={20} strokeWidth={1.75} />
                </button>
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/5" aria-label="标签">
                  <Tag size={20} strokeWidth={1.75} />
                </button>
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/5" aria-label="清单">
                  <Inbox size={20} strokeWidth={1.75} />
                </button>
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/5" aria-label="更多">
                  <MoreHorizontal size={20} strokeWidth={1.75} />
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  disabled
                  className="flex h-10 w-10 items-center justify-center rounded-lg opacity-40"
                  aria-label="语音输入（暂未开放）"
                  title="语音输入即将开放"
                >
                  <Mic size={20} strokeWidth={1.75} />
                </button>
              </div>
            </form>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}
