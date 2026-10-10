import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { parseNaturalDate } from '../../lib/dates'
import { dayjs } from '../../lib/dates'

export function QuickAdd() {
  const quickAdd = useAppStore((s) => s.quickAdd)
  const [value, setValue] = useState('')
  const preview = value.trim() ? parseNaturalDate(value) : null

  return (
    <form
      className="flex flex-col gap-1 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        quickAdd(value.trim())
        setValue('')
      }}
    >
      <div className="flex items-center gap-2">
        <Plus size={18} className="text-blue-500" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="添加任务，试试「明天 14:00 开会」"
          className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[var(--color-muted)]"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm text-white disabled:opacity-40 hover:bg-blue-600"
        >
          添加
        </button>
      </div>
      {preview?.dueAt && (
        <div className="pl-7 text-xs text-blue-500">
          识别日期：{dayjs(preview.dueAt).format('M月D日 HH:mm')}
          {preview.cleanedTitle !== value.trim() && (
            <span className="text-[var(--color-muted)]"> · 标题「{preview.cleanedTitle}」</span>
          )}
        </div>
      )}
    </form>
  )
}
