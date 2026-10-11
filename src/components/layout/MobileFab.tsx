import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  Ellipsis,
  Flag,
  FolderInput,
  Plus,
  Send,
  Tag as TagIcon,
  X,
} from 'lucide-react'
import { Drawer } from 'vaul'
import { useAppStore } from '../../store/useAppStore'
import { dayjs, formatDue, parseNaturalDate } from '../../lib/dates'
import { INBOX_ID, PRIORITY_COLORS, PRIORITY_LABELS, TAG_COLORS } from '../../lib/constants'
import { useBackHandler } from '../../lib/backNav'
import { cn } from '../../lib/cn'
import { PriorityFlag } from '../common/PriorityFlag'
import type { Priority } from '../../types'

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

/** 抽屉工具条当前展开的面板（互斥）。 */
type AddTool = 'date' | 'priority' | 'tags' | 'list' | null

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

/** 快捷日期：与自然语言解析的「无时间默认 09:00」保持一致。 */
function quickDue(offsetDays: number) {
  return dayjs()
    .add(offsetDays, 'day')
    .hour(9)
    .minute(0)
    .second(0)
    .millisecond(0)
    .toISOString()
}

/** 已选属性小胶囊（可点 × 移除）。 */
function AttrChip({
  icon,
  label,
  onRemove,
}: {
  icon: ReactNode
  label: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-lg bg-[var(--color-surface-2)] py-1 pl-2 pr-0.5 text-xs text-[var(--color-fg)]/85">
      {icon}
      <span className="truncate">{label}</span>
      <button
        type="button"
        aria-label={`移除 ${label}`}
        onClick={onRemove}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--color-muted)] active:opacity-60"
      >
        <X size={11} strokeWidth={2.5} />
      </button>
    </span>
  )
}

export function MobileFab() {
  const quickAdd = useAppStore((s) => s.quickAdd)
  const addTag = useAppStore((s) => s.addTag)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const activeView = useAppStore((s) => s.activeView)
  const lists = useAppStore((s) => s.lists)
  const tags = useAppStore((s) => s.tags)
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
  const [tool, setTool] = useState<AddTool>(null)
  const [due, setDue] = useState<string | null>(null)
  const [priority, setPriority] = useState<Priority>(0)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [listId, setListId] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [newTagText, setNewTagText] = useState('')
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

  const resetDraft = useCallback(() => {
    setValue('')
    setTool(null)
    setDue(null)
    setPriority(0)
    setTagIds([])
    setListId('')
    setNote('')
    setNoteOpen(false)
    setNewTagText('')
  }, [])

  // Android 返回键：先收起快速添加抽屉
  useBackHandler(open, () => {
    setOpen(false)
    resetDraft()
    return true
  })

  const openDrawer = () => {
    setListId(targetList?.id ?? INBOX_ID)
    setOpen(true)
  }

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
      openDrawer()
    }
  }

  const left = live?.x ?? baseLeft
  const top = live?.y ?? baseTop

  const preview = value.trim() ? parseNaturalDate(value) : null
  const dueLocal = due ? dayjs(due).format('YYYY-MM-DDTHH:mm') : ''
  const listChanged = !!listId && listId !== (targetList?.id ?? '')

  const submit = () => {
    const raw = value.trim()
    if (!raw) return
    const parsed = parseNaturalDate(raw)
    quickAdd(raw, {
      title: parsed.cleanedTitle || raw,
      dueAt: due ?? parsed.dueAt,
      priority,
      tags: tagIds,
      listId: listId || targetList?.id || INBOX_ID,
      note: note.trim(),
    })
    resetDraft()
    setOpen(false)
  }

  const toggleTag = (id: string) =>
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  /** 就地新建标签并挂到本次添加（重名自动复用）。 */
  const createTag = () => {
    const clean = newTagText.trim().replace(/^#/, '')
    if (!clean) return
    const existing = tags.find((t) => t.name === clean)
    const tag = existing ?? addTag(clean, TAG_COLORS[tags.length % TAG_COLORS.length])
    setTagIds((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]))
    setNewTagText('')
  }

  const toolBtnCls = (on: boolean) =>
    cn(
      'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:bg-[var(--color-surface-2)]',
      on ? 'bg-brand/10 text-brand' : 'text-[var(--color-muted)]',
    )

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
          if (!v) resetDraft()
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col rounded-t-[20px] bg-[var(--color-card)] outline-none md:hidden"
            style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))' }}
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
          >
            <div className="mx-auto mb-0.5 mt-2 h-1 w-9 shrink-0 rounded-full bg-[var(--color-muted)]/35" />
            <Drawer.Title className="sr-only">快速添加</Drawer.Title>
            <Drawer.Description className="sr-only">输入要做的事，可设置日期、优先级、标签与清单</Drawer.Description>
            <form
              className="flex min-h-0 min-w-0 flex-col overflow-y-auto px-3 pb-0.5 pt-0.5"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              {/* 标题输入 */}
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="准备做什么？试试「明天 14:00 开会」"
                enterKeyHint="done"
                className="accent-caret min-h-11 w-full bg-transparent px-1 text-[16px] font-medium text-[var(--color-fg)] outline-none placeholder:font-normal placeholder:text-[var(--color-muted)]"
              />

              {/* 描述（「⋯」展开， TickTick 同款紧跟标题） */}
              {noteOpen && (
                <textarea
                  autoFocus
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="描述"
                  className="accent-caret mt-0.5 w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-[var(--color-muted)]"
                />
              )}

              {/* 识别日期 + 已选属性胶囊 */}
              {(preview?.dueAt || due || priority > 0 || tagIds.length > 0 || listChanged || note.trim()) && (
                <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5 pt-0.5 text-xs">
                  {preview?.dueAt && !due && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-1 font-medium text-brand">
                      <CalendarDays size={12} strokeWidth={2} />
                      识别日期：{dayjs(preview.dueAt).format('M月D日 HH:mm')}
                    </span>
                  )}
                  {due && (
                    <AttrChip
                      icon={<CalendarDays size={12} strokeWidth={2} className="text-brand" />}
                      label={formatDue(due)}
                      onRemove={() => setDue(null)}
                    />
                  )}
                  {priority > 0 && (
                    <AttrChip
                      icon={<Flag size={12} strokeWidth={2} style={{ color: PRIORITY_COLORS[priority] }} fill={PRIORITY_COLORS[priority]} />}
                      label={PRIORITY_LABELS[priority]}
                      onRemove={() => setPriority(0)}
                    />
                  )}
                  {tagIds.map((id) => {
                    const t = tags.find((x) => x.id === id)
                    if (!t) return null
                    return (
                      <AttrChip
                        key={id}
                        icon={<span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />}
                        label={`#${t.name}`}
                        onRemove={() => toggleTag(id)}
                      />
                    )
                  })}
                  {listChanged &&
                    (() => {
                      const l = lists.find((x) => x.id === listId)
                      if (!l) return null
                      return (
                        <AttrChip
                          icon={<span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />}
                          label={l.name}
                          onRemove={() => setListId(targetList?.id ?? '')}
                        />
                      )
                    })()}
                  {note.trim() && (
                    <AttrChip
                      icon={<Ellipsis size={12} strokeWidth={2} className="text-brand" />}
                      label="描述"
                      onRemove={() => {
                        setNote('')
                        setNoteOpen(false)
                      }}
                    />
                  )}
                  {preview && preview.cleanedTitle !== value.trim() && !due && (
                    <span className="truncate text-[11px] text-[var(--color-muted)]">标题「{preview.cleanedTitle}」</span>
                  )}
                </div>
              )}

              {/* 工具面板（互斥展开） */}
              {tool === 'date' && (
                <div className="animate-fade-in mx-0.5 mb-2 space-y-2 rounded-2xl bg-[var(--color-surface-2)] p-2.5">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { label: '今天', offset: 0 },
                        { label: '明天', offset: 1 },
                      ] as const
                    ).map(({ label, offset }) => (
                      <button
                        key={label}
                        type="button"
                        className={cn(
                          'min-h-9 rounded-full px-3.5 text-xs font-medium active:opacity-80',
                          due && dayjs(due).isSame(quickDue(offset), 'day')
                            ? 'bg-brand text-white'
                            : 'bg-brand/15 text-brand',
                        )}
                        onClick={() => {
                          setDue(quickDue(offset))
                          setTool(null)
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    {due && (
                      <button
                        type="button"
                        className="min-h-9 rounded-full border border-[var(--color-border)] px-3.5 text-xs text-[var(--color-muted)] active:opacity-80"
                        onClick={() => setDue(null)}
                      >
                        清除
                      </button>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={dueLocal}
                    onChange={(e) => setDue(e.target.value ? dayjs(e.target.value).toISOString() : null)}
                    className="field-focus w-full rounded-xl bg-[var(--color-card)] px-3 py-2 text-sm outline-none"
                    aria-label="选择日期时间"
                  />
                </div>
              )}

              {tool === 'priority' && (
                <div className="animate-fade-in mx-0.5 mb-2 flex flex-wrap gap-2 rounded-2xl bg-[var(--color-surface-2)] p-2.5">
                  {([3, 2, 1, 0] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={cn(
                        'flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs active:opacity-80',
                        priority === p ? 'text-white' : 'border border-[var(--color-border)] text-[var(--color-fg)]/85',
                      )}
                      style={priority === p ? { background: PRIORITY_COLORS[p] } : undefined}
                      onClick={() => {
                        setPriority(p)
                        setTool(null)
                      }}
                    >
                      <PriorityFlag priority={p} size={13} />
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              )}

              {tool === 'tags' && (
                <div className="animate-fade-in mx-0.5 mb-2 flex max-h-36 flex-wrap items-center gap-1.5 overflow-y-auto rounded-2xl bg-[var(--color-surface-2)] p-2.5">
                  {tags.map((t) => {
                    const on = tagIds.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className={cn(
                          'min-h-8 rounded-full px-2.5 py-1 text-xs active:opacity-80',
                          on ? 'text-white' : 'border border-[var(--color-border)] text-[var(--color-fg)]/85',
                        )}
                        style={on ? { background: t.color } : undefined}
                      >
                        #{t.name}
                      </button>
                    )
                  })}
                  <form
                    className="flex min-h-8 items-center gap-1 rounded-full border border-dashed border-[var(--color-border)] px-2.5 py-1"
                    onSubmit={(e) => {
                      e.preventDefault()
                      createTag()
                    }}
                  >
                    <Plus size={12} className="shrink-0 text-[var(--color-muted)]" />
                    <input
                      value={newTagText}
                      onChange={(e) => setNewTagText(e.target.value)}
                      placeholder="新建标签"
                      aria-label="新建标签"
                      className="accent-caret w-20 bg-transparent text-xs outline-none placeholder:text-[var(--color-muted)]"
                    />
                  </form>
                </div>
              )}

              {tool === 'list' && (
                <div className="animate-fade-in mx-0.5 mb-2 max-h-40 overflow-y-auto rounded-2xl bg-[var(--color-surface-2)] p-1.5">
                  {lists.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={cn(
                        'flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm active:opacity-80',
                        listId === l.id ? 'bg-brand/15 font-medium text-brand' : 'text-[var(--color-fg)]/90',
                      )}
                      onClick={() => {
                        setListId(l.id)
                        setTool(null)
                      }}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.color }} />
                      <span className="min-w-0 flex-1 truncate">{l.name}</span>
                      {listId === l.id && <Check size={14} strokeWidth={2.5} />}
                    </button>
                  ))}
                </div>
              )}

              {/* 底部工具条：日期 / 优先级 / 标签 / 清单 / 更多 + 发送 */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="设置日期"
                  aria-expanded={tool === 'date'}
                  className={toolBtnCls(tool === 'date' || !!due)}
                  onClick={() => setTool(tool === 'date' ? null : 'date')}
                >
                  <CalendarDays size={21} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label={`优先级：${PRIORITY_LABELS[priority]}`}
                  aria-expanded={tool === 'priority'}
                  className={toolBtnCls(tool === 'priority' || priority > 0)}
                  onClick={() => setTool(tool === 'priority' ? null : 'priority')}
                >
                  <Flag
                    size={20}
                    strokeWidth={1.75}
                    style={priority > 0 ? { color: PRIORITY_COLORS[priority] } : undefined}
                    fill={priority > 0 ? PRIORITY_COLORS[priority] : 'none'}
                  />
                </button>
                <button
                  type="button"
                  aria-label={`标签${tagIds.length ? `：已选 ${tagIds.length} 个` : ''}`}
                  aria-expanded={tool === 'tags'}
                  className={toolBtnCls(tool === 'tags' || tagIds.length > 0)}
                  onClick={() => setTool(tool === 'tags' ? null : 'tags')}
                >
                  <TagIcon size={20} strokeWidth={1.75} />
                  {tagIds.length > 0 && (
                    <span className="tnum absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold leading-none text-white">
                      {tagIds.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label="移动到清单"
                  aria-expanded={tool === 'list'}
                  className={toolBtnCls(tool === 'list' || listChanged)}
                  onClick={() => setTool(tool === 'list' ? null : 'list')}
                >
                  <FolderInput size={20} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label="描述"
                  aria-expanded={noteOpen}
                  className={toolBtnCls(noteOpen || !!note.trim())}
                  onClick={() => setNoteOpen((v) => !v)}
                >
                  <Ellipsis size={20} strokeWidth={1.75} />
                </button>

                <button
                  type="submit"
                  disabled={!value.trim()}
                  aria-label="保存任务"
                  className={cn(
                    'ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95',
                    value.trim()
                      ? 'bg-brand text-white shadow-md shadow-brand/35'
                      : 'bg-brand/25 text-white/70',
                  )}
                >
                  <Send size={18} strokeWidth={2} className="-translate-x-px translate-y-px" />
                </button>
              </div>
            </form>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}
