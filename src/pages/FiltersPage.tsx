import { ListFilter } from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { useAppStore } from '../store/useAppStore'
import { PRIORITY_LABELS, PRIORITY_COLORS } from '../lib/constants'
import { cn } from '../lib/cn'
import type { Priority } from '../types'

function Chip({
  on,
  onClick,
  children,
  color,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  color?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition',
        on
          ? 'border-transparent text-white'
          : 'border-[var(--color-border)] text-[var(--color-fg)]/80',
      )}
      style={on ? { background: color ?? 'var(--color-brand)' } : undefined}
    >
      {children}
    </button>
  )
}

/** 过滤器页：配置全局过滤（优先级 / 清单 / 标签），作用于所有任务列表视图。 */
export function FiltersPage() {
  const filter = useAppStore((s) => s.filter)
  const setFilter = useAppStore((s) => s.setFilter)
  const lists = useAppStore((s) => s.lists)
  const tags = useAppStore((s) => s.tags)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const lastListView = useAppStore((s) => s.lastListView)
  const goBack = () => setActiveView(lastListView)

  const active =
    filter.priorities.length + filter.listIds.length + filter.tagIds.length > 0 || !!filter.query

  const togglePriority = (p: Priority) => {
    setFilter({
      priorities: filter.priorities.includes(p)
        ? filter.priorities.filter((x) => x !== p)
        : [...filter.priorities, p],
    })
  }
  const toggleList = (id: string) => {
    setFilter({
      listIds: filter.listIds.includes(id)
        ? filter.listIds.filter((x) => x !== id)
        : [...filter.listIds, id],
    })
  }
  const toggleTag = (id: string) => {
    setFilter({
      tagIds: filter.tagIds.includes(id)
        ? filter.tagIds.filter((x) => x !== id)
        : [...filter.tagIds, id],
    })
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-surface-2)]">
      <PageHeader
        title="过滤器"
        onBack={goBack}
        subtitle="作用于任务列表视图"
        right={
          active ? (
            <button
              type="button"
              className="flex min-h-11 items-center px-3 text-sm text-brand active:opacity-70"
              onClick={() => setFilter({ priorities: [], listIds: [], tagIds: [], query: '' })}
            >
              清除全部
            </button>
          ) : undefined
        }
      />
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <div className="rounded-2xl bg-[var(--color-card)] p-4">
          <div className="mb-3 text-[15px] font-medium">优先级</div>
          <div className="flex flex-wrap gap-2">
            {([3, 2, 1, 0] as Priority[]).map((p) => (
              <Chip
                key={p}
                on={filter.priorities.includes(p)}
                onClick={() => togglePriority(p)}
                color={PRIORITY_COLORS[p]}
              >
                {PRIORITY_LABELS[p]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--color-card)] p-4">
          <div className="mb-3 text-[15px] font-medium">清单</div>
          <div className="flex flex-wrap gap-2">
            {lists.map((l) => (
              <Chip key={l.id} on={filter.listIds.includes(l.id)} onClick={() => toggleList(l.id)}>
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.name}
              </Chip>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--color-card)] p-4">
          <div className="mb-3 text-[15px] font-medium">标签</div>
          {tags.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <ListFilter size={14} /> 暂无标签
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <Chip key={t.id} on={filter.tagIds.includes(t.id)} onClick={() => toggleTag(t.id)} color={t.color}>
                  #{t.name}
                </Chip>
              ))}
            </div>
          )}
        </div>

        {active && (
          <p className="px-2 text-xs text-[var(--color-muted)]">
            过滤器生效中——回到任务列表即可看到筛选结果。
          </p>
        )}
      </div>
    </div>
  )
}
