import { Flag } from 'lucide-react'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/constants'
import type { Priority } from '../../types'
import { cn } from '../../lib/cn'

export function PriorityFlag({
  priority,
  size = 14,
  showLabel = false,
  className,
}: {
  priority: Priority
  size?: number
  showLabel?: boolean
  className?: string
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      title={PRIORITY_LABELS[priority]}
    >
      <Flag size={size} style={{ color: PRIORITY_COLORS[priority] }} fill={priority > 0 ? PRIORITY_COLORS[priority] : 'none'} />
      {showLabel && <span className="text-xs text-[var(--color-muted)]">{PRIORITY_LABELS[priority]}</span>}
    </span>
  )
}
