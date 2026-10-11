import { useEffect, useRef, type ReactNode } from 'react'
export type SwipeSide = 'leading' | 'trailing'
interface SwipeRowProps {
  /** 是否处于展开态（受控）。 */
  open: boolean
  side: SwipeSide | null
  onOpenChange: (side: SwipeSide | null) => void
  leadingWidth: number
  trailingWidth: number
  leadingActions?: ReactNode
  trailingActions?: ReactNode
  blockSwipe?: boolean
  children: ReactNode
}
/** 拖过这个距离（或足够快的轻扫）即呼出；否则弹回。比「按钮总宽」短得多，手感更轻。 */
const OPEN_THRESHOLD = 64
/** 轻扫速度阈值 px/ms（约 0.4 px/ms ≈ 一记快扫）。 */
const FLICK_VELOCITY = 0.4
/** 起手判定：先确认横向意图再接管手势。 */
const LOCK_THRESHOLD = 8
/**
 * 任务行左右滑（自研轻实现，替代 react-swipeable-list）：
 * - 呼出条件 = 拖过 OPEN_THRESHOLD 或快扫（与按钮总宽无关，步长短）；
 * - 拖动 1:1 跟手，超出按钮宽度有橡皮筋阻尼；
 * - 已展开时反向拖过一半即收起，快扫反向直接收起；
 * - 手势结束后的 click 会被吞掉（避免弹回时误开详情）。
 *
 * DOM 类名保留 swipeable-list-item / swipe-action 系列，便于测试与样式复用。
 */
export function SwipeRow({
  open,
  side,
  onOpenChange,
  leadingWidth,
  trailingWidth,
  leadingActions,
  trailingActions,
  blockSwipe,
  children,
}: SwipeRowProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const swipeEndAt = useRef(0)
  const gesture = useRef<{
    id: number
    startX: number
    startY: number
    base: number
    locked: '' | 'x' | 'y'
    lastX: number
    lastT: number
    vx: number
  } | null>(null)
  const openRef = useRef(open)
  openRef.current = open
  const sideRef = useRef(side)
  sideRef.current = side
  const openWidthOf = (s: SwipeSide) => (s === 'trailing' ? trailingWidth : leadingWidth)
  /** 把行摆到目标位置（受控 open/side 变化时；拖动中跳过，由手势直接写 transform）。 */
  useEffect(() => {
    const el = contentRef.current
    if (!el || gesture.current) return
    const w = open && side ? openWidthOf(side) : 0
    const x = side === 'trailing' ? -w : w
    offsetRef.current = x
    el.style.transition = ''
    el.style.transform = `translateX(${x}px)`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, side, leadingWidth, trailingWidth])
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || blockSwipe) return
    const applyOffset = (x: number) => {
      offsetRef.current = x
      if (contentRef.current) contentRef.current.style.transform = `translateX(${x}px)`
    }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      gesture.current = {
        id: t.identifier,
        startX: t.clientX,
        startY: t.clientY,
        base: offsetRef.current,
        locked: '',
        lastX: t.clientX,
        lastT: e.timeStamp,
        vx: 0,
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      const g = gesture.current
      if (!g) return
      const t = Array.from(e.touches).find((x) => x.identifier === g.id)
      if (!t) return
      const dx = t.clientX - g.startX
      const dy = t.clientY - g.startY
      if (!g.locked) {
        if (Math.abs(dx) < LOCK_THRESHOLD && Math.abs(dy) < LOCK_THRESHOLD) return
        // 横向意图明确（且比纵向更明显）才接管，否则让给页面滚动
        g.locked = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'
        if (g.locked === 'x' && contentRef.current) {
          contentRef.current.style.transition = 'none'
          contentRef.current.classList.remove('swipe-row-anim')
        }
      }
      if (g.locked !== 'x') return
      // 横向手势期间阻止页面滚动
      if (e.cancelable) e.preventDefault()
      let next = g.base + dx
      const minEff = trailingActions ? -trailingWidth : 0
      const maxEff = leadingActions ? leadingWidth : 0
      if (next < minEff) next = minEff + (next - minEff) * (trailingActions ? 0.25 : 0)
      if (next > maxEff) next = maxEff + (next - maxEff) * (leadingActions ? 0.25 : 0)
      applyOffset(next)
      const dt = e.timeStamp - g.lastT
      if (dt > 0) {
        g.vx = (t.clientX - g.lastX) / dt
        g.lastX = t.clientX
        g.lastT = e.timeStamp
      }
    }
    const onTouchEnd = () => {
      const g = gesture.current
      gesture.current = null
      if (!g || g.locked !== 'x') return
      swipeEndAt.current = Date.now()
      contentRef.current?.classList.add('swipe-row-anim')
      const offset = offsetRef.current
      const base = g.base
      let target: SwipeSide | null
      if (base === 0) {
        // 从关闭态：拖过阈值，或朝某侧快扫
        if (offset <= -OPEN_THRESHOLD || (g.vx < -FLICK_VELOCITY && offset < -16)) target = 'trailing'
        else if (offset >= OPEN_THRESHOLD || (g.vx > FLICK_VELOCITY && offset > 16)) target = 'leading'
        else target = null
      } else {
        // 从展开态：反向拖过一半或反向快扫即收起，否则保持展开
        const wasTrailing = base < 0
        const closingFlick = wasTrailing ? g.vx > FLICK_VELOCITY : g.vx < -FLICK_VELOCITY
        const openingFlick = wasTrailing ? g.vx < -FLICK_VELOCITY : g.vx > FLICK_VELOCITY
        const beyondHalf = Math.abs(offset) >= Math.abs(base) / 2
        if (beyondHalf || openingFlick) target = wasTrailing ? 'trailing' : 'leading'
        else if (closingFlick || Math.abs(offset) < Math.abs(base) / 2) target = null
        else target = wasTrailing ? 'trailing' : 'leading'
      }
      if (target !== sideRef.current || (target !== null) !== openRef.current) {
        onOpenChange(target)
      }
      // 立即摆到目标位（open/side effect 会再次对齐，双保险）
      const w = target ? openWidthOf(target) : 0
      applyOffset(target === 'trailing' ? -w : w)
    }
    // 滑动结束后的 click 视为手势残留，吞掉以免误开详情
    const onClickCapture = (e: MouseEvent) => {
      if (Date.now() - swipeEndAt.current < 250) {
        e.stopPropagation()
        e.preventDefault()
      }
    }
    wrap.addEventListener('touchstart', onTouchStart, { passive: true })
    wrap.addEventListener('touchmove', onTouchMove, { passive: false })
    wrap.addEventListener('touchend', onTouchEnd)
    wrap.addEventListener('touchcancel', onTouchEnd)
    wrap.addEventListener('click', onClickCapture, true)
    return () => {
      wrap.removeEventListener('touchstart', onTouchStart)
      wrap.removeEventListener('touchmove', onTouchMove)
      wrap.removeEventListener('touchend', onTouchEnd)
      wrap.removeEventListener('touchcancel', onTouchEnd)
      wrap.removeEventListener('click', onClickCapture, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockSwipe, leadingWidth, trailingWidth])
  return (
    <div ref={wrapRef} className="swipeable-list-item">
      {leadingActions && (
        <div className="swipeable-list-item__leading-actions" aria-hidden={side !== 'leading'}>
          {leadingActions}
        </div>
      )}
      {trailingActions && (
        <div className="swipeable-list-item__trailing-actions" aria-hidden={side !== 'trailing'}>
          {trailingActions}
        </div>
      )}
      <div ref={contentRef} className={`swipeable-list-item__content swipe-row-anim ${open ? 'swipe-row-open' : ''}`}>
        {children}
      </div>
    </div>
  )
}
