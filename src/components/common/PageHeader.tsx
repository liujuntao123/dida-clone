import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

/**
 * 模块页（搜索 / 清单 / 标签 / 过滤器）共用的整页头部：
 * 左返回 + 标题 + 右侧操作区，处理顶部安全区。
 */
export function PageHeader({
  title,
  onBack,
  right,
  subtitle,
}: {
  title: ReactNode
  onBack: () => void
  right?: ReactNode
  subtitle?: ReactNode
}) {
  return (
    <div
      className="flex min-h-12 shrink-0 items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2"
      style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' }}
    >
      <button
        type="button"
        aria-label="返回"
        onClick={onBack}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-[var(--color-fg)] active:opacity-70"
      >
        <ArrowLeft size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-semibold">{title}</h1>
        {subtitle && <div className="truncate text-xs text-[var(--color-muted)]">{subtitle}</div>}
      </div>
      <div className="flex shrink-0 items-center">{right}</div>
    </div>
  )
}
