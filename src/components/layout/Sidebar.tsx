import {
  AlignLeft,
  Archive,
  Ban,
  CalendarDays,
  CheckCircle2,
  Folder,
  Inbox,
  LayoutGrid,
  ListFilter,
  ListChecks,
  Plus,
  Search,
  Settings,
  Settings2,
  Tag as TagIcon,
  Trash2,
  User,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { LIST_COLORS, TAG_COLORS } from '../../lib/constants'
import { dayjs } from '../../lib/dates'
import { ThemeToggle } from '../common/ThemeToggle'
import { cn } from '../../lib/cn'
import type { ModuleId, SmartListId } from '../../types'

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

/** 智能清单图标：橙色圆角方块 + 白色图形（复刻滴答清单抽屉样式）。 */
function SmartIcon({ children, plain = false }: { children: ReactNode; plain?: boolean }) {
  if (plain) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--color-fg)]">
        {children}
      </span>
    )
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-brand text-white">
      {children}
    </span>
  )
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
  const inboxId = lists.find((l) => l.isInbox)?.id ?? 'list-inbox'
  const [newListName, setNewListName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [showAddList, setShowAddList] = useState(false)
  const [showAddTag, setShowAddTag] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const isSmart = (id: SmartListId) => activeView.kind === 'smart' && activeView.id === id
  const isList = (id: string) => activeView.kind === 'list' && activeView.id === id
  const isTag = (id: string) => activeView.kind === 'tag' && activeView.id === id
  const isModule = (id: ModuleId) => activeView.kind === 'module' && activeView.id === id

  const go = (view: Parameters<typeof setActiveView>[0]) => {
    setAddMenuOpen(false)
    setActiveView(view)
  }

  const todoCountForTag = (tagId: string) =>
    tasks.filter((t) => !t.parentId && t.status === 'todo' && t.tags.includes(tagId)).length

  if (variant === 'mobile') {
    const todayNum = dayjs().date()
    const weekday = dayjs().format('dd') // zh-cn: 一/二/…/日

    const smartRows: Array<{
      id: SmartListId
      label: string
      count: number
      icon: ReactNode
    }> = [
      {
        id: 'all',
        label: '所有',
        count: countForSmart('all', tasks, inboxId),
        icon: (
          <SmartIcon>
            <Archive size={15} strokeWidth={2.25} />
          </SmartIcon>
        ),
      },
      {
        id: 'today',
        label: '今天',
        count: countForSmart('today', tasks, inboxId),
        icon: (
          <SmartIcon>
            <span className="flex h-full w-full flex-col items-center justify-center leading-none">
              <span className="mb-px h-[2.5px] w-3 rounded-full bg-white/80" />
              <span className="text-[11px] font-bold">{todayNum}</span>
            </span>
          </SmartIcon>
        ),
      },
      {
        id: 'next7',
        label: '最近7天',
        count: countForSmart('next7', tasks, inboxId),
        icon: (
          <SmartIcon>
            <span className="flex h-full w-full flex-col items-center justify-center leading-none">
              <span className="mb-px h-[2.5px] w-3 rounded-full bg-white/80" />
              <span className="text-[11px] font-bold">{weekday}</span>
            </span>
          </SmartIcon>
        ),
      },
      {
        id: 'inbox',
        label: '收集箱',
        count: countForSmart('inbox', tasks, inboxId),
        icon: (
          <SmartIcon>
            <Inbox size={15} strokeWidth={2.25} />
          </SmartIcon>
        ),
      },
      {
        id: 'completed',
        label: '已完成',
        count: countForSmart('completed', tasks, inboxId),
        icon: (
          <SmartIcon plain>
            <AlignLeft size={20} strokeWidth={2} />
          </SmartIcon>
        ),
      },
      {
        id: 'abandoned',
        label: '已放弃',
        count: countForSmart('abandoned', tasks, inboxId),
        icon: (
          <SmartIcon>
            <X size={16} strokeWidth={2.75} />
          </SmartIcon>
        ),
      },
      {
        id: 'trash',
        label: '垃圾桶',
        count: countForSmart('trash', tasks, inboxId),
        icon: (
          <SmartIcon plain>
            <Trash2 size={19} strokeWidth={1.75} />
          </SmartIcon>
        ),
      },
    ]

    return (
      <aside
        className="relative flex h-full w-full flex-col bg-[var(--color-surface)] text-[var(--color-fg)]"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* 头部：头像 + 用户名 + 搜索 / 设置 */}
        <div className="flex items-center gap-3 px-4 pb-2 pt-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-card)]">
            <User size={22} className="text-brand" />
          </div>
          <div className="min-w-0 flex-1 truncate text-[17px] font-semibold">用户</div>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center text-[var(--color-fg)]/85 active:opacity-70"
            aria-label="搜索"
            onClick={() => go({ kind: 'module', id: 'search' })}
          >
            <Search size={21} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center text-[var(--color-fg)]/85 active:opacity-70"
            aria-label="设置"
            onClick={() => go({ kind: 'module', id: 'settings' })}
          >
            <Settings size={21} strokeWidth={1.75} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 pb-2 pt-1">
          {smartRows.map(({ id, label, icon, count }) => {
            const active = isSmart(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => go({ kind: 'smart', id })}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'mb-0.5 flex w-full min-h-12 items-center gap-3.5 rounded-xl px-2.5 text-[15px] transition',
                  active ? 'bg-brand/15' : 'active:bg-[var(--color-surface-2)]',
                )}
              >
                {icon}
                <span className="flex-1 text-left">{label}</span>
                {count > 0 && <span className="text-sm text-[var(--color-muted)]">{count}</span>}
              </button>
            )
          })}
        </nav>

        {/* ＋添加 弹出菜单：清单 / 过滤器 / 标签（各自独立页面） */}
        {addMenuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="关闭菜单"
              onClick={() => setAddMenuOpen(false)}
            />
            <div
              className="animate-slide-up fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-4 z-50 w-48 rounded-2xl bg-[var(--color-card)] p-1.5 shadow-2xl"
              role="menu"
            >
              {(
                [
                  { id: 'lists', label: '清单', Icon: Folder as LucideIcon },
                  { id: 'filters', label: '过滤器', Icon: ListFilter as LucideIcon },
                  { id: 'tags', label: '标签', Icon: TagIcon as LucideIcon },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] active:bg-[var(--color-surface-2)]"
                  onClick={() => go({ kind: 'module', id: id as ModuleId })}
                >
                  <Icon size={18} strokeWidth={1.75} className="text-[var(--color-fg)]/85" />
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* 底部操作条：＋添加（弹出菜单） + 清单管理 */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-1.5">
          <button
            type="button"
            className="flex min-h-11 items-center gap-2.5 px-1.5 text-[16px] text-[var(--color-fg)]/90"
            onClick={() => setAddMenuOpen((v) => !v)}
            aria-expanded={addMenuOpen}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md border-[1.5px] border-[var(--color-fg)]/70">
              <Plus size={15} strokeWidth={2.25} />
            </span>
            添加
          </button>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center text-[var(--color-fg)]/85"
            aria-label="管理清单"
            onClick={() => go({ kind: 'module', id: 'lists' })}
          >
            <Settings2 size={20} strokeWidth={1.75} />
          </button>
        </div>
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
            { id: 'tomorrow' as const, label: '明天', icon: CalendarDays },
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
            <span className="flex-1 truncate text-left">{t.name}</span>
            <span className="text-xs text-[var(--color-muted)]">{todoCountForTag(t.id) || ''}</span>
          </button>
        ))}

        <div className="mb-1 mt-4 px-2 text-xs font-medium text-[var(--color-muted)]">模块</div>
        <button type="button" className={itemCls(isModule('calendar'))} onClick={() => go({ kind: 'module', id: 'calendar' })}>
          <CalendarDays size={16} /> 日历
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
