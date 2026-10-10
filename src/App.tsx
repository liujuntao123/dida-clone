import { AppLayout } from './components/layout/AppLayout'
import { TaskListPanel } from './components/tasks/TaskList'
import { CalendarView } from './components/calendar/CalendarView'
import { BoardView } from './components/board/BoardView'
import { QuadrantView } from './components/matrix/QuadrantView'
import { PomodoroTimer } from './components/pomodoro/PomodoroTimer'
import { SettingsPage } from './pages/SettingsPage'
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
      case 'pomodoro':
        return <PomodoroTimer />
      case 'settings':
        return <SettingsPage />
    }
  }

  return <TaskListPanel />
}

export default function App() {
  return (
    <AppLayout>
      <MainContent />
    </AppLayout>
  )
}
