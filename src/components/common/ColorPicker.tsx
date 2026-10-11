import { cn } from '../../lib/cn'
import { PALETTE } from '../../lib/constants'

/**
 * TickTick 风格颜色选择行：无颜色（斜杠圆）+ 色板 + 自定义（彩虹环）。
 * value 为空字符串表示「无颜色」。
 */
export function ColorPicker({
  value,
  onChange,
  allowNone = true,
}: {
  value: string
  onChange: (color: string) => void
  allowNone?: boolean
}) {
  const isPreset = (PALETTE as readonly string[]).includes(value)
  const custom = value && !isPreset ? value : '#4d8ef7'
  return (
    <div className="flex flex-wrap items-center gap-3">
      {allowNone && (
        <button
          type="button"
          aria-label="无颜色"
          aria-pressed={value === ''}
          onClick={() => onChange('')}
          className={cn(
            'relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 transition',
            value === '' ? 'border-[var(--color-fg)]/70' : 'border-[var(--color-muted)]/50',
          )}
        >
          <span className="absolute h-0.5 w-[125%] rotate-45 bg-[var(--color-muted)]" />
        </button>
      )}
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`颜色 ${c}`}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90',
            value === c && 'ring-2 ring-[var(--color-fg)]/55 ring-offset-2 ring-offset-[var(--color-card)]',
          )}
          style={{ background: c }}
        />
      ))}
      {/* 自定义颜色：彩虹环 + 内圈即时预览 */}
      <label
        aria-label="自定义颜色"
        className={cn(
          'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full p-[3px] transition active:scale-90',
          value && !isPreset
            ? 'ring-2 ring-[var(--color-fg)]/55 ring-offset-2 ring-offset-[var(--color-card)]'
            : '',
        )}
        style={{ background: 'conic-gradient(#ee5252,#f2913d,#f7c948,#4cd07d,#4d8ef7,#9a6ef7,#f269b4,#ee5252)' }}
      >
        <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--color-card)] p-[3px]">
          <span className="h-full w-full rounded-full" style={{ background: custom }} />
        </span>
        <input
          type="color"
          value={custom}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}
