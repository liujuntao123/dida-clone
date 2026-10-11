import { useAppStore } from '../../store/useAppStore'
import { PRIORITY_LABELS } from '../../lib/constants'
import type { Priority, SortBy } from '../../types'

export function FilterBar() {
  const filter = useAppStore((s) => s.filter)
  const setFilter = useAppStore((s) => s.setFilter)
  const sortBy = useAppStore((s) => s.sortBy)
  const setSortBy = useAppStore((s) => s.setSortBy)
  const lists = useAppStore((s) => s.lists)
  const tags = useAppStore((s) => s.tags)

  const togglePriority = (p: Priority) => {
    const has = filter.priorities.includes(p)
    setFilter({
      priorities: has ? filter.priorities.filter((x) => x !== p) : [...filter.priorities, p],
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs">
      <label className="flex items-center gap-1.5 text-[var(--color-muted)]">
        排序
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="min-h-8 rounded-lg bg-[var(--color-surface-2)] px-2 py-1 text-xs outline-none"
        >
          <option value="due">日期</option>
          <option value="priority">优先级</option>
          <option value="created">创建时间</option>
          <option value="custom">自定义</option>
        </select>
      </label>

      <span className="text-[var(--color-muted)]">优先级</span>
      {([3, 2, 1, 0] as Priority[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => togglePriority(p)}
          className={`min-h-8 rounded-full px-2.5 py-1 transition ${
            filter.priorities.includes(p)
              ? 'bg-brand/15 font-medium text-brand'
              : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
          }`}
        >
          {PRIORITY_LABELS[p]}
        </button>
      ))}

      <select
        value={filter.listIds[0] ?? ''}
        onChange={(e) => setFilter({ listIds: e.target.value ? [e.target.value] : [] })}
        className="min-h-8 rounded-lg bg-[var(--color-surface-2)] px-2 py-1 text-xs outline-none"
      >
        <option value="">全部清单</option>
        {lists.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>

      <select
        value={filter.tagIds[0] ?? ''}
        onChange={(e) => setFilter({ tagIds: e.target.value ? [e.target.value] : [] })}
        className="min-h-8 rounded-lg bg-[var(--color-surface-2)] px-2 py-1 text-xs outline-none"
      >
        <option value="">全部标签</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      {(filter.priorities.length > 0 || filter.listIds.length > 0 || filter.tagIds.length > 0 || filter.query) && (
        <button
          type="button"
          className="min-h-8 font-medium text-brand hover:text-brand-hover"
          onClick={() => setFilter({ priorities: [], listIds: [], tagIds: [], query: '' })}
        >
          清除筛选
        </button>
      )}
    </div>
  )
}
