import { cn } from '../../lib/cn'

/** 调色板：红/橙/黄/黄绿/绿/蓝（同参考图一行排布），附加「无颜色」与自定义取色。 */
const PALETTE = [
  '#ee5252',
  '#f2913d',
  '#f7c948',
  '#cddc39',
  '#4cd07d',
  '#4d8ef7',
] as const

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
    <div className="flex flex-wrap items-center gap-2">
      {allowNone && (
        <button
          type="button"
          aria-label="无颜色"
          aria-pressed={value === ''}
          onClick={() => onChange('')}
          className={cn(
            'relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2',
            value === '' ? 'border-[var(--color-fg)]/70' : 'border-[var(--color-muted)]/60',
          )}
        >
          <span className="absolute h-0.5 w-[120%] rotate-45 bg-[var(--color-muted)]" />
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
            'h-8 w-8 rounded-full transition',
            value === c && 'ring-2 ring-[var(--color-fg)]/60 ring-offset-2 ring-offset-[var(--color-card)]',
          )}
          style={{ background: c }}
        />
      ))}
      {/* 自定义颜色：彩虹环 + 内圈即时预览 */}
      <label
        aria-label="自定义颜色"
        className={cn(
          'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full p-[2.5px]',
          value && !isPreset
            ? 'ring-2 ring-[var(--color-fg)]/60 ring-offset-2 ring-offset-[var(--color-card)]'
            : '',
        )}
        style={{ background: 'conic-gradient(#ee5252,#f2913d,#f7c948,#4cd07d,#4d8ef7,#8b5cf6,#ec4899,#ee5252)' }}
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
