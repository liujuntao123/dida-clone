import { useEffect } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { TaskListPanel } from './components/tasks/TaskList'
import { CalendarView } from './components/calendar/CalendarView'
import { QuadrantView } from './components/matrix/QuadrantView'
import { SettingsPage } from './pages/SettingsPage'
import { SearchPage } from './pages/SearchPage'
import { ListsPage } from './pages/ListsPage'
import { TagsPage } from './pages/TagsPage'
import { FiltersPage } from './pages/FiltersPage'
import { AuthPage } from './pages/AuthPage'
import { bootSession } from './lib/session'
import { useSessionStore } from './store/useSessionStore'
import { useAppStore } from './store/useAppStore'
import type { ReactNode } from 'react'

function MainContent() {
  const activeView = useAppStore((s) => s.activeView)

  // 切换视图时的轻量过场动画（key 变化触发 remount + view-in 动画）
  const viewKey = `${activeView.kind}-${activeView.id}`

  let content: ReactNode
  if (activeView.kind === 'module') {
    switch (activeView.id) {
      case 'calendar':
        content = <CalendarView />
        break
      case 'quadrant':
        content = <QuadrantView />
        break
      case 'settings':
        content = <SettingsPage />
        break
      case 'search':
        content = <SearchPage />
        break
      case 'lists':
        content = <ListsPage />
        break
      case 'tags':
        content = <TagsPage />
        break
      case 'filters':
        content = <FiltersPage />
        break
      default:
        content = null
    }
  } else {
    content = <TaskListPanel />
  }

  return (
    <div key={viewKey} className="animate-view-in h-full">
      {content}
    </div>
  )
}

export default function App() {
  const phase = useSessionStore((s) => s.phase)

  useEffect(() => {
    void bootSession()
  }, [])

  if (phase === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--color-surface-2)]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
      </div>
    )
  }
  if (phase === 'anon') {
    return <AuthPage />
  }
  return (
    <AppLayout>
      <MainContent />
    </AppLayout>
  )
}
