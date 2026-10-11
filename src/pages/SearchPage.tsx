import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { SwipeableList, Type as SwipeType } from 'react-swipeable-list'
import 'react-swipeable-list/dist/styles.css'
import { PageHeader } from '../components/common/PageHeader'
import { TaskItem } from '../components/tasks/TaskItem'
import { useAppStore } from '../store/useAppStore'
import { dayjs } from '../lib/dates'
import { useIsMobile } from '../hooks/useIsMobile'

/** 全局搜索页：按标题/描述实时过滤（不含垃圾桶与子任务）。 */
export function SearchPage() {
  const tasks = useAppStore((s) => s.tasks)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const lastListView = useAppStore((s) => s.lastListView)
  const goBack = () => setActiveView(lastListView)
  const isMobile = useIsMobile()

  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = tasks.filter((t) => !t.parentId && t.status !== 'trashed')
    if (!q) return []
    return base
      .filter((t) => `${t.title}\n${t.note ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const pin = Number(!!b.pinned) - Number(!!a.pinned)
        if (pin !== 0) return pin
        if (a.dueAt && b.dueAt) return dayjs(a.dueAt).valueOf() - dayjs(b.dueAt).valueOf()
        if (a.dueAt) return -1
        if (b.dueAt) return 1
        return a.order - b.order
      })
  }, [tasks, query])

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-surface-2)]">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Search size={18} className="shrink-0 text-[var(--color-muted)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') goBack()
              }}
              placeholder="搜索任务标题、描述…"
              aria-label="搜索任务"
              className="accent-caret w-full bg-transparent text-[16px] outline-none placeholder:text-[var(--color-muted)]"
            />
            {query && (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                className="shrink-0 text-[var(--color-muted)]"
              >
                <X size={18} />
              </button>
            )}
          </div>
        }
        onBack={goBack}
      />
      <div className="flex-1 overflow-y-auto p-3">
        {!query.trim() ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Search size={28} className="text-[var(--color-muted)]" />
            <p className="text-sm text-[var(--color-muted)]">输入关键词搜索所有任务</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-sm text-[var(--color-muted)]">没有找到「{query.trim()}」相关任务</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-[var(--color-card)]">
            <div className="px-4 pb-1 pt-3 text-xs text-[var(--color-muted)]">
              {results.length} 条结果
            </div>
            <div className="px-1 pb-2">
              {isMobile ? (
                <SwipeableList type={SwipeType.IOS} threshold={0.35} className="swipe-task-list">
                  {results.map((t) => (
                    <TaskItem key={t.id} task={t} compact />
                  ))}
                </SwipeableList>
              ) : (
                results.map((t) => <TaskItem key={t.id} task={t} compact />)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
