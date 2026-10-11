import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'

/**
 * 返回键导航：一个「后进先出」的处理器栈 + 视图层兜底。
 *
 * - 组件用 useBackHandler(active, handler) 注册临时层级（抽屉 / 弹层 / 表单页），
 *   active 变化时自动入栈 / 出栈。
 * - Android 硬件返回键（capacitor backButton）调用 handleAppBack()：
 *   依次尝试栈顶处理器 → 侧栏 → 任务详情抽屉 → 全屏模块页 → 返回 false（退出应用）。
 */

type BackHandler = () => boolean

const stack: BackHandler[] = []

/** 视图层兜底：没有任何组件层处理器时按主页面层级回退。 */
export function handleAppBack(): boolean {
  while (stack.length > 0) {
    const handler = stack[stack.length - 1]
    if (handler()) return true
    // 处理器自认无法处理（比如状态已过期）→ 出栈继续
    const i = stack.indexOf(handler)
    if (i >= 0) stack.splice(i, 1)
  }

  const s = useAppStore.getState()
  if (s.sidebarOpen) {
    s.setSidebarOpen(false)
    return true
  }
  if (s.selectedTaskId) {
    s.setSelectedTaskId(null)
    return true
  }
  // 全屏跳转的模块页 → 回到主页面（最近一次任务视图）
  if (
    s.activeView.kind === 'module' &&
    ['settings', 'search', 'lists', 'tags', 'filters'].includes(s.activeView.id)
  ) {
    s.setActiveView(s.lastListView)
    return true
  }
  return false
}

/**
 * 声明式注册返回键处理器：active 为 true 时入栈，false / 卸载时出栈。
 * handler 返回 true 表示「已处理」，返回 false 表示放弃（继续往下兜底）。
 */
export function useBackHandler(active: boolean, handler: BackHandler) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!active) return
    const fn: BackHandler = () => ref.current()
    stack.push(fn)
    return () => {
      const i = stack.indexOf(fn)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [active])
}
