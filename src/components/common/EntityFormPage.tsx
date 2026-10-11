import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageHeader } from './PageHeader'
import { ColorPicker } from './ColorPicker'

/**
 * 清单 / 标签共用的「添加/编辑」表单页：
 * 居中标题 + 右上 ✓ 保存；名称卡片（图标实时着色）+ 颜色卡片 +（编辑态）删除行。
 * 视觉与交互对齐 TickTick 的添加清单/标签页。
 */
export function EntityFormPage({
  title,
  icon,
  iconColor,
  name,
  onNameChange,
  color,
  onColorChange,
  allowNone,
  canSave,
  onSave,
  onBack,
  deleteLabel,
  onDelete,
}: {
  title: string
  /** 名称卡片左侧的图标（会按所选颜色实时着色）。 */
  icon: ReactNode
  iconColor: string
  name: string
  onNameChange: (v: string) => void
  color: string
  onColorChange: (c: string) => void
  allowNone?: boolean
  canSave: boolean
  onSave: () => void
  onBack: () => void
  deleteLabel?: string
  onDelete?: () => void
}) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-surface-2)]">
      <PageHeader
        center
        title={title}
        onBack={onBack}
        right={
          <button
            type="button"
            aria-label="保存"
            disabled={!canSave}
            onClick={onSave}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-[var(--color-fg)] transition active:bg-[var(--color-surface-2)] disabled:opacity-30"
          >
            <Check size={22} strokeWidth={2.5} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {/* 名称 */}
        <div className="flex h-14 items-center gap-3 rounded-2xl bg-[var(--color-card)] px-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center" style={{ color: iconColor }}>
            {icon}
          </span>
          <input
            autoFocus
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave()
            }}
            placeholder="名称"
            maxLength={30}
            className="accent-caret min-h-14 w-full bg-transparent text-[16px] outline-none placeholder:text-[var(--color-muted)]"
          />
          {name && (
            <button
              type="button"
              aria-label="清空名称"
              onClick={() => onNameChange('')}
              className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-muted)] active:opacity-70"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* 颜色 */}
        <div className="mt-3 rounded-2xl bg-[var(--color-card)] px-4 py-4">
          <div className="mb-3 text-[13px] text-[var(--color-muted)]">颜色</div>
          <ColorPicker value={color} onChange={onColorChange} allowNone={allowNone} />
        </div>

        {/* 删除（仅编辑态） */}
        {deleteLabel && onDelete && (
          <button
            type="button"
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--color-card)] text-[15px] text-red-500 active:opacity-70"
            onClick={onDelete}
          >
            {deleteLabel}
          </button>
        )}
      </div>
    </div>
  )
}
