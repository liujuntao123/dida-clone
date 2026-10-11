import { useEffect, useMemo, useRef, useState } from 'react'
import { Folder, Search, Tag as TagIcon, X } from 'lucide-react'
import { SwipeableList, Type as SwipeType } from 'react-swipeable-list'
import 'react-swipeable-list/dist/styles.css'
import { TaskItem } from '../components/tasks/TaskItem'
import { useAppStore } from '../store/useAppStore'
import { dayjs } from '../lib/dates'
import { cn } from '../lib/cn'
import { useIsMobile } from '../hooks/useIsMobile'

type Scope = 'tasks' | 'tags' | 'lists'

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'tasks', label: '任务' },
  { id: 'tags', label: '标签' },
  { id: 'lists', label: '清单' },
]

/**
 * 全局搜索页（参考滴答清单）：
 * 圆角搜索框 + 右侧「取消」，下方 任务 / 标签 / 清单 范围切换。
 * 任务按标题/描述实时过滤（不含垃圾桶与子任务）；标签/清单命中后点击直达对应视图。
 */
export function SearchPage() {
  const tasks = useAppStore((s) => s.tasks)
  const tags = useAppStore((s) => s.tags)
  const lists = useAppStore((s) => s.lists)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const lastListView = useAppStore((s) => s.lastListView)
  const goBack = () => setActiveView(lastListView)
  const isMobile = useIsMobile()

  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>('tasks')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const q = query.trim().toLowerCase()

  const taskResults = useMemo(() => {
    if (!q) return []
    return tasks
      .filter((t) => !t.parentId && t.status !== 'trashed')
      .filter((t) => `${t.title}\n${t.note ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const pin = Number(!!b.pinned) - Number(!!a.pinned)
        if (pin !== 0) return pin
        if (a.dueAt && b.dueAt) return dayjs(a.dueAt).valueOf() - dayjs(b.dueAt).valueOf()
        if (a.dueAt) return -1
        if (b.dueAt) return 1
        return a.order - b.order
      })
  }, [tasks, q])

  const tagResults = useMemo(
    () => (q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : []),
    [tags, q],
  )
  const listResults = useMemo(
    () => (q ? lists.filter((l) => l.name.toLowerCase().includes(q)) : []),
    [lists, q],
  )

  const scopeCount =
    scope === 'tasks' ? taskResults.length : scope === 'tags' ? tagResults.length : listResults.length

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-surface-2)]">
      <h1 className="sr-only">搜索</h1>
      {/* 搜索条：圆角卡片 + 右侧「取消」，参考滴答清单搜索页 */}
      <div
        className="flex shrink-0 items-center gap-2 px-3 pb-2"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-[var(--color-card)] px-3">
          <Search size={18} className="shrink-0 text-[var(--color-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') goBack()
            }}
            placeholder="搜索"
            aria-label="搜索任务、标签、清单"
            className="accent-caret min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--color-muted)]"
          />
          {query && (
            <button
              type="button"
              aria-label="清空搜索"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="shrink-0 text-[var(--color-muted)] active:opacity-70"
            >
              <X size={17} />
            </button>
          )}
        </div>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-lg px-1 text-[16px] font-medium text-brand active:opacity-70"
          onClick={goBack}
        >
          取消
        </button>
      </div>

      {/* 范围切换：任务 / 标签 / 清单 */}
      <div className="flex shrink-0 gap-2 px-3 pb-2">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={scope === s.id}
            onClick={() => setScope(s.id)}
            className={cn(
              'flex min-h-10 items-center rounded-full px-4 text-[15px] transition',
              scope === s.id
                ? 'bg-brand font-medium text-white'
                : 'bg-[var(--color-card)] text-[var(--color-fg)]/85 active:bg-[var(--color-surface)]',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!q ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--color-card)]">
              <Search size={32} className="text-[var(--color-muted)]/50" strokeWidth={1.25} />
            </div>
            <p className="text-[15px] font-medium text-[var(--color-fg)]/90">你想搜索什么</p>
            <p className="text-[13px] text-[var(--color-muted)]">输入关键词即可搜索任务、标签和清单</p>
          </div>
        ) : scopeCount === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-sm text-[var(--color-muted)]">没有找到「{query.trim()}」相关{SCOPES.find((s) => s.id === scope)?.label}</p>
          </div>
        ) : scope === 'tasks' ? (
          <div className="overflow-hidden rounded-2xl bg-[var(--color-card)]">
            <div className="tnum px-4 pb-1 pt-3 text-xs text-[var(--color-muted)]">
              {taskResults.length} 条结果
            </div>
            <div className="px-1 pb-2">
              {isMobile ? (
                <SwipeableList type={SwipeType.IOS} threshold={0.35} className="swipe-task-list">
                  {taskResults.map((t) => (
                    <TaskItem key={t.id} task={t} compact />
                  ))}
                </SwipeableList>
              ) : (
                taskResults.map((t) => <TaskItem key={t.id} task={t} compact />)
              )}
            </div>
          </div>
        ) : scope === 'tags' ? (
          <div className="overflow-hidden rounded-2xl bg-[var(--color-card)]">
            {tagResults.map((t, i) => (
              <button
                key={t.id}
                type="button"
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-[var(--color-surface-2)]',
                  i > 0 && 'border-t border-[var(--color-border)]',
                )}
                onClick={() => setActiveView({ kind: 'tag', id: t.id })}
              >
                <TagIcon size={18} style={{ color: t.color }} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[15px]">{t.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-[var(--color-card)]">
            {listResults.map((l, i) => (
              <button
                key={l.id}
                type="button"
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-[var(--color-surface-2)]',
                  i > 0 && 'border-t border-[var(--color-border)]',
                )}
                onClick={() => setActiveView(l.isInbox ? { kind: 'smart', id: 'inbox' } : { kind: 'list', id: l.id })}
              >
                <Folder size={18} style={{ color: l.color }} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[15px]">{l.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
