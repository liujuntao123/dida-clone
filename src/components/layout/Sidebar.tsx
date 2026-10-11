import {
  Archive,
  Ban,
  CalendarDays,
  CheckCircle2,
  Inbox,
  LayoutGrid,
  ListChecks,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SquareKanban,
  Tag as TagIcon,
  Trash2,
  User,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { LIST_COLORS, TAG_COLORS } from '../../lib/constants'
import { dayjs } from '../../lib/dates'
import { ThemeToggle } from '../common/ThemeToggle'
import { cn } from '../../lib/cn'
import type { SmartListId } from '../../types'

type Variant = 'desktop' | 'mobile'

function countForSmart(id: SmartListId, tasks: ReturnType<typeof useAppStore.getState>['tasks'], inboxId: string) {
  const base = tasks.filter((t) => !t.parentId)
  switch (id) {
    case 'all':
      return base.filter((t) => t.status === 'todo').length
    case 'today':
      return base.filter((t) => t.status === 'todo' && t.dueAt && dayjs(t.dueAt).isSame(dayjs(), 'day')).length
    case 'next7': {
      const end = dayjs().add(7, 'day').endOf('day')
      return base.filter(
        (t) =>
          t.status === 'todo' &&
          t.dueAt &&
          !dayjs(t.dueAt).isBefore(dayjs().startOf('day')) &&
          !dayjs(t.dueAt).isAfter(end),
      ).length
    }
    case 'inbox':
      return base.filter((t) => t.status === 'todo' && t.listId === inboxId).length
    case 'completed':
      return base.filter((t) => t.status === 'done').length
    case 'abandoned':
      return base.filter((t) => t.status === 'abandoned').length
    case 'trash':
      return base.filter((t) => t.status === 'trashed').length
    default:
      return 0
  }
}

export function Sidebar({ variant = 'desktop' }: { variant?: Variant }) {
  const lists = useAppStore((s) => s.lists)
  const tags = useAppStore((s) => s.tags)
  const tasks = useAppStore((s) => s.tasks)
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const addList = useAppStore((s) => s.addList)
  const addTag = useAppStore((s) => s.addTag)
  const setFilter = useAppStore((s) => s.setFilter)
  const filter = useAppStore((s) => s.filter)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const inboxId = lists.find((l) => l.isInbox)?.id ?? 'list-inbox'
  const [newListName, setNewListName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [showAddList, setShowAddList] = useState(false)
  const [showAddTag, setShowAddTag] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const isSmart = (id: SmartListId) => activeView.kind === 'smart' && activeView.id === id
  const isList = (id: string) => activeView.kind === 'list' && activeView.id === id
  const isTag = (id: string) => activeView.kind === 'tag' && activeView.id === id
  const isModule = (id: 'calendar' | 'board' | 'quadrant' | 'settings') =>
    activeView.kind === 'module' && activeView.id === id

  const go = (view: Parameters<typeof setActiveView>[0]) => {
    setActiveView(view)
    setSidebarOpen(false)
  }

  const mobileSmart = useMemo(
    () =>
      [
        { id: 'all' as const, label: '所有', Icon: Archive, count: countForSmart('all', tasks, inboxId) },
        { id: 'today' as const, label: '今天', Icon: CalendarDays, count: countForSmart('today', tasks, inboxId), badge: String(dayjs().date()) },
        { id: 'next7' as const, label: '最近7天', Icon: CalendarDays, count: countForSmart('next7', tasks, inboxId) },
        { id: 'inbox' as const, label: '收集箱', Icon: Inbox, count: countForSmart('inbox', tasks, inboxId) },
        { id: 'completed' as const, label: '已完成', Icon: ListChecks, count: countForSmart('completed', tasks, inboxId) },
        { id: 'abandoned' as const, label: '已放弃', Icon: Ban, count: countForSmart('abandoned', tasks, inboxId) },
        { id: 'trash' as const, label: '垃圾桶', Icon: Trash2, count: countForSmart('trash', tasks, inboxId) },
      ] as const,
    [tasks, inboxId],
  )

  if (variant === 'mobile') {
    return (
      <aside
        className="flex h-full w-full flex-col bg-[var(--color-surface)] text-[var(--color-fg)]"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-border)]">
            <User size={22} className="text-brand" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold">用户</div>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center text-[var(--color-muted)]"
            aria-label="设置"
            onClick={() => go({ kind: 'module', id: 'settings' })}
          >
            <Settings size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {mobileSmart.map(({ id, label, Icon, count, ...rest }) => {
            const active = isSmart(id)
            const badge = 'badge' in rest ? (rest as { badge?: string }).badge : undefined
            return (
              <button
                key={id}
                type="button"
                onClick={() => go({ kind: 'smart', id })}
                className={cn(
                  'mb-0.5 flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition',
                  active ? 'bg-brand/20 text-[var(--color-fg)]' : 'text-[var(--color-fg)]/90 hover:bg-[var(--color-surface-2)]',
                )}
              >
                <span className="relative text-brand">
                  <Icon size={20} strokeWidth={1.75} />
                  {badge && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center pt-1 text-[9px] font-bold text-brand">
                      {badge}
                    </span>
                  )}
                </span>
                <span className="flex-1 text-left">{label}</span>
                {typeof count === 'number' && count > 0 && (
                  <span className="text-sm text-[var(--color-muted)]">{count}</span>
                )}
              </button>
            )
          })}

          {lists.filter((l) => !l.isInbox).length > 0 && (
            <div className="mt-3 border-t border-[var(--color-border)] pt-2">
              {lists
                .filter((l) => !l.isInbox)
                .map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={cn(
                      'mb-0.5 flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]',
                      isList(l.id) ? 'bg-brand/20' : 'hover:bg-[var(--color-surface-2)]',
                    )}
                    onClick={() => go({ kind: 'list', id: l.id })}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                    <span className="flex-1 text-left">{l.name}</span>
                  </button>
                ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-3 border-t border-[var(--color-border)] pt-2">
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    'mb-0.5 flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]',
                    isTag(t.id) ? 'bg-brand/20' : 'hover:bg-[var(--color-surface-2)]',
                  )}
                  onClick={() => go({ kind: 'tag', id: t.id })}
                >
                  <TagIcon size={18} style={{ color: t.color }} />
                  <span className="flex-1 text-left">{t.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 border-t border-[var(--color-border)] pt-2">
            <button
              type="button"
              className={cn(
                'mb-0.5 flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]',
                isModule('board') ? 'bg-brand/20' : 'hover:bg-[var(--color-surface-2)]',
              )}
              onClick={() => go({ kind: 'module', id: 'board' })}
            >
              <SquareKanban size={20} className="text-brand" strokeWidth={1.75} />
              <span className="flex-1 text-left">看板</span>
            </button>
          </div>
        </nav>

        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 text-[15px] text-[var(--color-fg)]/90"
            onClick={() => setShowAddList(true)}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded border border-[var(--color-border)]">
              <Plus size={14} />
            </span>
            添加
          </button>
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 text-[15px] text-[var(--color-fg)]/90"
            onClick={() => setManageOpen((v) => !v)}
            aria-expanded={manageOpen}
          >
            <MoreHorizontal size={18} />
            管理
          </button>
        </div>

        {showAddList && (
          <form
            className="border-t border-[var(--color-border)] px-3 py-2"
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
              className="w-full rounded-lg bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none"
            />
          </form>
        )}

        {manageOpen && (
          <div className="border-t border-[var(--color-border)] px-3 py-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-3 text-[var(--color-muted)]" />
              <input
                value={filter.query}
                onChange={(e) => setFilter({ query: e.target.value })}
                placeholder="搜索任务…"
                className="mb-2 w-full rounded-lg bg-[var(--color-card)] py-2 pl-8 pr-3 text-sm outline-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-muted)]">主题</span>
              <ThemeToggle />
            </div>
          </div>
        )}
      </aside>
    )
  }

  // Desktop — richer sidebar
  const itemCls = (active: boolean) =>
    cn(
      'flex w-full min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition',
      active
        ? 'bg-brand/15 text-brand'
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
        <div className="flex items-center gap-2 font-semibold text-brand">
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
            className="w-full rounded-lg bg-[var(--color-surface-2)] py-2 pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-brand/40"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="mb-1 px-2 text-xs font-medium text-[var(--color-muted)]">智能清单</div>
        {(
          [
            { id: 'all' as const, label: '所有', icon: Archive },
            { id: 'today' as const, label: '今天', icon: CalendarDays },
            { id: 'next7' as const, label: '最近7天', icon: CalendarDays },
            { id: 'inbox' as const, label: '收集箱', icon: Inbox },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={itemCls(isSmart(id))} onClick={() => go({ kind: 'smart', id })}>
            <Icon size={16} />
            <span className="flex-1 text-left">{label}</span>
            <span className="text-xs text-[var(--color-muted)]">{countForSmart(id, tasks, inboxId) || ''}</span>
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
              className="flex-1 rounded bg-[var(--color-surface-2)] px-2 py-1 text-sm outline-none"
            />
          </form>
        )}
        {lists
          .filter((l) => !l.isInbox)
          .map((l) => (
            <button key={l.id} type="button" className={itemCls(isList(l.id))} onClick={() => go({ kind: 'list', id: l.id })}>
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
              className="flex-1 rounded bg-[var(--color-surface-2)] px-2 py-1 text-sm outline-none"
            />
          </form>
        )}
        {tags.map((t) => (
          <button key={t.id} type="button" className={itemCls(isTag(t.id))} onClick={() => go({ kind: 'tag', id: t.id })}>
            <TagIcon size={14} style={{ color: t.color }} />
            {t.name}
          </button>
        ))}

        <div className="mb-1 mt-4 px-2 text-xs font-medium text-[var(--color-muted)]">模块</div>
        <button type="button" className={itemCls(isModule('calendar'))} onClick={() => go({ kind: 'module', id: 'calendar' })}>
          <CalendarDays size={16} /> 日历
        </button>
        <button type="button" className={itemCls(isModule('board'))} onClick={() => go({ kind: 'module', id: 'board' })}>
          <SquareKanban size={16} /> 看板
        </button>
        <button type="button" className={itemCls(isModule('quadrant'))} onClick={() => go({ kind: 'module', id: 'quadrant' })}>
          <LayoutGrid size={16} /> 四象限
        </button>

        <div className="mb-1 mt-4 px-2 text-xs font-medium text-[var(--color-muted)]">其他</div>
        <button type="button" className={itemCls(isSmart('completed'))} onClick={() => go({ kind: 'smart', id: 'completed' })}>
          <ListChecks size={16} />
          <span className="flex-1 text-left">已完成</span>
          <span className="text-xs text-[var(--color-muted)]">{countForSmart('completed', tasks, inboxId) || ''}</span>
        </button>
        <button type="button" className={itemCls(isSmart('abandoned'))} onClick={() => go({ kind: 'smart', id: 'abandoned' })}>
          <Ban size={16} />
          <span className="flex-1 text-left">已放弃</span>
          <span className="text-xs text-[var(--color-muted)]">{countForSmart('abandoned', tasks, inboxId) || ''}</span>
        </button>
        <button type="button" className={itemCls(isSmart('trash'))} onClick={() => go({ kind: 'smart', id: 'trash' })}>
          <Trash2 size={16} />
          <span className="flex-1 text-left">垃圾桶</span>
          <span className="text-xs text-[var(--color-muted)]">{countForSmart('trash', tasks, inboxId) || ''}</span>
        </button>
        <button type="button" className={itemCls(isModule('settings'))} onClick={() => go({ kind: 'module', id: 'settings' })}>
          <Settings size={16} /> 设置
        </button>
      </nav>
    </aside>
  )
}
