import {
  CalendarDays,
  CheckCircle2,
  Inbox,
  LayoutGrid,
  ListTodo,
  Plus,
  Search,
  Settings,
  SquareKanban,
  Target,
  Trash2,
  Ban,
  Tag as TagIcon,
  Sun,
  Sunrise,
  CalendarRange,
} from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { LIST_COLORS, TAG_COLORS } from '../../lib/constants'
import { ThemeToggle } from '../common/ThemeToggle'
import { cn } from '../../lib/cn'
import type { SmartListId } from '../../types'

const smartItems: { id: SmartListId; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox', label: '收集箱', icon: Inbox },
  { id: 'today', label: '今天', icon: Sun },
  { id: 'tomorrow', label: '明天', icon: Sunrise },
  { id: 'next7', label: '最近7天', icon: CalendarRange },
  { id: 'all', label: '全部', icon: ListTodo },
]

export function Sidebar() {
  const lists = useAppStore((s) => s.lists)
  const tags = useAppStore((s) => s.tags)
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const addList = useAppStore((s) => s.addList)
  const addTag = useAppStore((s) => s.addTag)
  const setFilter = useAppStore((s) => s.setFilter)
  const filter = useAppStore((s) => s.filter)
  const [newListName, setNewListName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [showAddList, setShowAddList] = useState(false)
  const [showAddTag, setShowAddTag] = useState(false)

  const isSmart = (id: SmartListId) =>
    activeView.kind === 'smart' && activeView.id === id
  const isList = (id: string) => activeView.kind === 'list' && activeView.id === id
  const isTag = (id: string) => activeView.kind === 'tag' && activeView.id === id
  const isModule = (id: 'calendar' | 'board' | 'quadrant' | 'pomodoro' | 'settings') =>
    activeView.kind === 'module' && activeView.id === id

  const itemCls = (active: boolean) =>
    cn(
      'flex w-full min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition',
      active
        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
        : 'text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]',
    )

  return (
    <aside
      className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
      }}
    >
      <div className="flex min-h-12 items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-blue-600">
          <CheckCircle2 size={22} />
          <span>滴答清单</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--color-muted)]" />
          <input
            value={filter.query}
            onChange={(e) => setFilter({ query: e.target.value })}
            placeholder="搜索任务…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="mb-1 px-2 text-xs font-medium text-[var(--color-muted)]">智能清单</div>
        {smartItems.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={itemCls(isSmart(id))} onClick={() => setActiveView({ kind: 'smart', id })}>
            <Icon size={16} />
            {label}
          </button>
        ))}

        <div className="mb-1 mt-4 flex items-center justify-between px-2">
          <span className="text-xs font-medium text-[var(--color-muted)]">清单</span>
          <button type="button" className="rounded p-0.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]" onClick={() => setShowAddList((v) => !v)}>
            <Plus size={14} />
          </button>
        </div>
        {showAddList && (
          <form
            className="mb-2 flex gap-1 px-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newListName.trim()) return
              addList(newListName.trim(), LIST_COLORS[lists.length % LIST_COLORS.length])
              setNewListName('')
              setShowAddList(false)
            }}
          >
            <input
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="清单名称"
              className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm outline-none"
            />
          </form>
        )}
        {lists.map((l) => (
          <button key={l.id} type="button" className={itemCls(isList(l.id))} onClick={() => setActiveView({ kind: 'list', id: l.id })}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            {l.name}
          </button>
        ))}

        <div className="mb-1 mt-4 flex items-center justify-between px-2">
          <span className="text-xs font-medium text-[var(--color-muted)]">标签</span>
          <button type="button" className="rounded p-0.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]" onClick={() => setShowAddTag((v) => !v)}>
            <Plus size={14} />
          </button>
        </div>
        {showAddTag && (
          <form
            className="mb-2 flex gap-1 px-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newTagName.trim()) return
              addTag(newTagName.trim(), TAG_COLORS[tags.length % TAG_COLORS.length])
              setNewTagName('')
              setShowAddTag(false)
            }}
          >
            <input
              autoFocus
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="标签名称"
              className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm outline-none"
            />
          </form>
        )}
        {tags.map((t) => (
          <button key={t.id} type="button" className={itemCls(isTag(t.id))} onClick={() => setActiveView({ kind: 'tag', id: t.id })}>
            <TagIcon size={14} style={{ color: t.color }} />
            {t.name}
          </button>
        ))}

        <div className="mb-1 mt-4 px-2 text-xs font-medium text-[var(--color-muted)]">模块</div>
        <button type="button" className={itemCls(isModule('calendar'))} onClick={() => setActiveView({ kind: 'module', id: 'calendar' })}>
          <CalendarDays size={16} /> 日历
        </button>
        <button type="button" className={itemCls(isModule('board'))} onClick={() => setActiveView({ kind: 'module', id: 'board' })}>
          <SquareKanban size={16} /> 看板
        </button>
        <button type="button" className={itemCls(isModule('quadrant'))} onClick={() => setActiveView({ kind: 'module', id: 'quadrant' })}>
          <LayoutGrid size={16} /> 四象限
        </button>
        <button type="button" className={itemCls(isModule('pomodoro'))} onClick={() => setActiveView({ kind: 'module', id: 'pomodoro' })}>
          <Target size={16} /> 番茄专注
        </button>

        <div className="mb-1 mt-4 px-2 text-xs font-medium text-[var(--color-muted)]">其他</div>
        <button type="button" className={itemCls(isSmart('completed'))} onClick={() => setActiveView({ kind: 'smart', id: 'completed' })}>
          <CheckCircle2 size={16} /> 已完成
        </button>
        <button type="button" className={itemCls(isSmart('abandoned'))} onClick={() => setActiveView({ kind: 'smart', id: 'abandoned' })}>
          <Ban size={16} /> 已放弃
        </button>
        <button type="button" className={itemCls(isSmart('trash'))} onClick={() => setActiveView({ kind: 'smart', id: 'trash' })}>
          <Trash2 size={16} /> 垃圾桶
        </button>
        <button type="button" className={itemCls(isModule('settings'))} onClick={() => setActiveView({ kind: 'module', id: 'settings' })}>
          <Settings size={16} /> 设置
        </button>
      </nav>
    </aside>
  )
}
