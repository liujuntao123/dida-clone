import { useShallow } from 'zustand/react/shallow'
import { SwipeableList, Type as SwipeType } from 'react-swipeable-list'
import 'react-swipeable-list/dist/styles.css'
import { useAppStore } from '../../store/useAppStore'
import { TaskItem } from './TaskItem'
import { QuickAdd } from './QuickAdd'
import { FilterBar } from './FilterBar'
import { TaskDetail } from './TaskDetail'
import { useIsMobile } from '../../hooks/useIsMobile'

export function TaskListPanel() {
  const isMobile = useIsMobile()
  const tasks = useAppStore(useShallow((s) => s.getVisibleTasks()))
  const activeView = useAppStore((s) => s.activeView)
  const lists = useAppStore((s) => s.lists)
  const tags = useAppStore((s) => s.tags)
  const emptyTrash = useAppStore((s) => s.emptyTrash)
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)

  let title = '任务'
  if (activeView.kind === 'smart') {
    const map: Record<string, string> = {
      inbox: '收集箱',
      today: '今天',
      tomorrow: '明天',
      next7: '最近7天',
      all: '全部',
      completed: '已完成',
      abandoned: '已放弃',
      trash: '垃圾桶',
    }
    title = map[activeView.id] ?? '任务'
  } else if (activeView.kind === 'list') {
    title = lists.find((l) => l.id === activeView.id)?.name ?? '清单'
  } else if (activeView.kind === 'tag') {
    title = `#${tags.find((t) => t.id === activeView.id)?.name ?? '标签'}`
  }

  const showQuickAdd =
    activeView.kind === 'list' ||
    (activeView.kind === 'smart' &&
      ['inbox', 'today', 'tomorrow', 'next7', 'all'].includes(activeView.id)) ||
    activeView.kind === 'tag'

  const listBody =
    tasks.length === 0 ? (
      <div className="p-8 text-center text-sm text-[var(--color-muted)]">暂无任务</div>
    ) : isMobile ? (
      <SwipeableList type={SwipeType.IOS} fullSwipe threshold={0.35} className="swipe-task-list">
        {tasks.map((t) => (
          <TaskItem key={t.id} task={t} />
        ))}
      </SwipeableList>
    ) : (
      tasks.map((t) => <TaskItem key={t.id} task={t} />)
    )

  return (
    <div className="flex h-full min-w-0 flex-1">
      {/* On mobile, list stays visible under the detail sheet */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-12 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <h1 className="text-lg font-semibold">{title}</h1>
          <span className="text-xs text-[var(--color-muted)]">{tasks.length} 项</span>
        </div>
        {/* Desktop keeps inline QuickAdd; mobile uses FAB */}
        {showQuickAdd && !isMobile && <QuickAdd />}
        {showQuickAdd && <FilterBar />}
        {activeView.kind === 'smart' && activeView.id === 'trash' && (
          <div className="border-b border-[var(--color-border)] px-3 py-2">
            <button
              type="button"
              className="min-h-11 text-sm text-red-500 hover:underline"
              onClick={() => emptyTrash()}
            >
              清空垃圾桶
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto bg-[var(--color-surface)] pb-4">
          {listBody}
        </div>
      </div>

      {/* Desktop / tablet side detail only */}
      {!isMobile && (
        selectedTaskId ? (
          <div className="flex h-full">
            <TaskDetail variant="panel" />
          </div>
        ) : (
          <div className="hidden lg:flex">
            <TaskDetail variant="panel" />
          </div>
        )
      )}
    </div>
  )
}
