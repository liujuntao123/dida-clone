import { AppLayout } from './components/layout/AppLayout'
import { TaskListPanel } from './components/tasks/TaskList'
import { CalendarView } from './components/calendar/CalendarView'
import { BoardView } from './components/board/BoardView'
import { QuadrantView } from './components/matrix/QuadrantView'
import { HabitsView } from './components/habits/HabitsView'
import { SettingsPage } from './pages/SettingsPage'
import { SyncBootstrap } from './components/common/SyncBootstrap'
import { useAppStore } from './store/useAppStore'

function MainContent() {
  const activeView = useAppStore((s) => s.activeView)

  if (activeView.kind === 'module') {
    switch (activeView.id) {
      case 'calendar':
        return <CalendarView />
      case 'board':
        return <BoardView />
      case 'quadrant':
        return <QuadrantView />
      case 'habits':
        return <HabitsView />
      case 'settings':
        return <SettingsPage />
    }
  }

  return <TaskListPanel />
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
