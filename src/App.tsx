import { AppLayout } from './components/layout/AppLayout'
import { TaskListPanel } from './components/tasks/TaskList'
import { CalendarView } from './components/calendar/CalendarView'
import { BoardView } from './components/board/BoardView'
import { QuadrantView } from './components/matrix/QuadrantView'
import { SettingsPage } from './pages/SettingsPage'
import { SyncBootstrap } from './components/common/SyncBootstrap'
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
      case 'board':
        content = <BoardView />
        break
      case 'quadrant':
        content = <QuadrantView />
        break
      case 'settings':
        content = <SettingsPage />
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
  return (
    <>
      <SyncBootstrap />
      <AppLayout>
        <MainContent />
      </AppLayout>
    </>
  )
}
