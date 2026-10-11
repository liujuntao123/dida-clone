import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

/**
 * 模块页（搜索 / 清单 / 标签 / 过滤器）共用的整页头部：
 * 左返回 + 标题 + 右侧操作区，处理顶部安全区。
 * center 时标题绝对居中（TickTick 的表单页风格），右操作区对称占位。
 */
export function PageHeader({
  title,
  onBack,
  right,
  subtitle,
  center,
}: {
  title: ReactNode
  onBack: () => void
  right?: ReactNode
  subtitle?: ReactNode
  center?: boolean
}) {
  if (center) {
    return (
      <div
        className="relative flex min-h-14 shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2"
        style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-fg)] active:bg-[var(--color-surface-2)]"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="pointer-events-none absolute inset-x-16 bottom-0 top-[max(6px,env(safe-area-inset-top,0px))] flex flex-col items-center justify-center">
          <h1 className="truncate text-[17px] font-semibold leading-tight">{title}</h1>
          {subtitle && <div className="truncate text-xs text-[var(--color-muted)]">{subtitle}</div>}
        </div>
        <div className="ml-auto flex shrink-0 items-center">{right}</div>
      </div>
    )
  }
  return (
    <div
      className="flex min-h-14 shrink-0 items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2"
      style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' }}
    >
      <button
        type="button"
        aria-label="返回"
        onClick={onBack}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-fg)] active:bg-[var(--color-surface-2)]"
      >
        <ArrowLeft size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-semibold leading-tight">{title}</h1>
        {subtitle && <div className="truncate text-xs text-[var(--color-muted)]">{subtitle}</div>}
      </div>
      <div className="flex shrink-0 items-center">{right}</div>
    </div>
  )
}
