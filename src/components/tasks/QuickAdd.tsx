import { CalendarDays, Plus } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { parseNaturalDate, dayjs } from '../../lib/dates'

export function QuickAdd() {
  const quickAdd = useAppStore((s) => s.quickAdd)
  const [value, setValue] = useState('')
  const preview = value.trim() ? parseNaturalDate(value) : null

  return (
    <form
      className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        quickAdd(value.trim())
        setValue('')
      }}
    >
      <div className="flex items-center gap-2">
        <Plus size={19} strokeWidth={2.25} className="shrink-0 text-brand" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="添加任务，试试「明天 14:00 开会」"
          className="accent-caret min-h-11 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--color-muted)]"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="btn-primary min-h-10 px-4 text-sm"
        >
          添加
        </button>
      </div>
      {preview?.dueAt && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1 pl-7 pt-0.5 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-0.5 font-medium text-brand">
            <CalendarDays size={12} strokeWidth={2} />
            识别日期：{dayjs(preview.dueAt).format('M月D日 HH:mm')}
          </span>
          {preview.cleanedTitle !== value.trim() && (
            <span className="text-[var(--color-muted)]">标题「{preview.cleanedTitle}」</span>
          )}
        </div>
      )}
    </form>
  )
}
