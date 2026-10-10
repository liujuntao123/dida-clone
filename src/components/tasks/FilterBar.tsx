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
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs">
      <label className="flex items-center gap-1 text-[var(--color-muted)]">
        排序
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="rounded border border-[var(--color-border)] bg-transparent px-1.5 py-1"
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
          className={`rounded-full px-2 py-0.5 border ${
            filter.priorities.includes(p)
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950'
              : 'border-[var(--color-border)]'
          }`}
        >
          {PRIORITY_LABELS[p]}
        </button>
      ))}

      <select
        value={filter.listIds[0] ?? ''}
        onChange={(e) => setFilter({ listIds: e.target.value ? [e.target.value] : [] })}
        className="rounded border border-[var(--color-border)] bg-transparent px-1.5 py-1"
      >
        <option value="">全部清单</option>
        {lists.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>

      <select
        value={filter.tagIds[0] ?? ''}
        onChange={(e) => setFilter({ tagIds: e.target.value ? [e.target.value] : [] })}
        className="rounded border border-[var(--color-border)] bg-transparent px-1.5 py-1"
      >
        <option value="">全部标签</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      {(filter.priorities.length > 0 || filter.listIds.length > 0 || filter.tagIds.length > 0 || filter.query) && (
        <button
          type="button"
          className="text-blue-500 hover:underline"
          onClick={() => setFilter({ priorities: [], listIds: [], tagIds: [], query: '' })}
        >
          清除筛选
        </button>
      )}
    </div>
  )
}
