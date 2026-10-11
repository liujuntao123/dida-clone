/**
 * 迷你环形进度（任务行的子任务进度、详情页进度环共用）。
 * label：环中心的文字（如「42%」），不传则只画环。
 */
export function ProgressRing({
  percent,
  size = 18,
  stroke = 2,
  label,
  className,
}: {
  percent: number
  size?: number
  stroke?: number
  label?: string
  className?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, percent))
  const offset = c * (1 - clamped / 100)
  return (
    <span
      className={`relative inline-block shrink-0 ${className ?? ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`进度 ${clamped}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {label != null && (
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium leading-none text-[var(--color-muted)] tnum">
          {label}
        </span>
      )}
    </span>
  )
}
