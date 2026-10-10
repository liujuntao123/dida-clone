import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Coffee } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { POMODORO_BREAK_SEC, POMODORO_FOCUS_SEC } from '../../lib/constants'
import { dayjs } from '../../lib/dates'
import { cn } from '../../lib/cn'

type Mode = 'focus' | 'break'

export function PomodoroTimer() {
  const tasks = useAppStore((s) => s.tasks)
  const sessions = useAppStore((s) => s.sessions)
  const addPomodoroSession = useAppStore((s) => s.addPomodoroSession)
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)

  const [mode, setMode] = useState<Mode>('focus')
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(selectedTaskId)
  const [remaining, setRemaining] = useState(POMODORO_FOCUS_SEC)
  const [running, setRunning] = useState(false)
  const startedAtRef = useRef<string | null>(null)
  const tickRef = useRef<number | null>(null)

  const total = mode === 'focus' ? POMODORO_FOCUS_SEC : POMODORO_BREAK_SEC
  const progress = 1 - remaining / total

  useEffect(() => {
    if (!running) {
      if (tickRef.current) window.clearInterval(tickRef.current)
      return
    }
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false)
          if (mode === 'focus' && startedAtRef.current) {
            addPomodoroSession({
              taskId: linkedTaskId,
              startedAt: startedAtRef.current,
              durationSec: POMODORO_FOCUS_SEC,
              completed: true,
            })
          }
          // auto switch
          const next: Mode = mode === 'focus' ? 'break' : 'focus'
          setMode(next)
          return next === 'focus' ? POMODORO_FOCUS_SEC : POMODORO_BREAK_SEC
        }
        return r - 1
      })
    }, 1000)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [running, mode, linkedTaskId, addPomodoroSession])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  const todoTasks = tasks.filter((t) => t.status === 'todo' && !t.parentId)
  const todaySec = sessions
    .filter((s) => s.completed && dayjs(s.startedAt).isSame(dayjs(), 'day'))
    .reduce((a, s) => a + s.durationSec, 0)

  const reset = () => {
    setRunning(false)
    setRemaining(mode === 'focus' ? POMODORO_FOCUS_SEC : POMODORO_BREAK_SEC)
    startedAtRef.current = null
  }

  return (
    <div className="flex h-full flex-col items-center overflow-auto bg-[var(--color-surface)] px-4 py-8">
      <h1 className="mb-2 text-lg font-semibold">番茄专注</h1>
      <p className="mb-6 text-xs text-[var(--color-muted)]">25 分钟专注 + 5 分钟休息</p>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          className={cn('rounded-full px-4 py-1.5 text-sm', mode === 'focus' ? 'bg-blue-500 text-white' : 'border border-[var(--color-border)]')}
          onClick={() => {
            setMode('focus')
            setRunning(false)
            setRemaining(POMODORO_FOCUS_SEC)
          }}
        >
          专注
        </button>
        <button
          type="button"
          className={cn('inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm', mode === 'break' ? 'bg-emerald-500 text-white' : 'border border-[var(--color-border)]')}
          onClick={() => {
            setMode('break')
            setRunning(false)
            setRemaining(POMODORO_BREAK_SEC)
          }}
        >
          <Coffee size={14} /> 休息
        </button>
      </div>

      <div className="relative mb-6 flex h-56 w-56 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--color-border)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={mode === 'focus' ? '#3b82f6' : '#10b981'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 54}
            strokeDashoffset={(1 - progress) * 2 * Math.PI * 54}
          />
        </svg>
        <div className="text-4xl font-semibold tabular-nums">
          {mm}:{ss}
        </div>
      </div>

      <div className="mb-6 flex gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-6 py-2.5 text-white hover:bg-blue-600"
          onClick={() => {
            if (!running) {
              startedAtRef.current = dayjs().toISOString()
              setRunning(true)
            } else {
              setRunning(false)
            }
          }}
        >
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? '暂停' : '开始'}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-4 py-2.5"
          onClick={reset}
        >
          <RotateCcw size={16} /> 重置
        </button>
      </div>

      <label className="mb-6 w-full max-w-sm text-sm">
        <span className="mb-1 block text-[var(--color-muted)]">关联任务</span>
        <select
          value={linkedTaskId ?? ''}
          onChange={(e) => setLinkedTaskId(e.target.value || null)}
          className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
        >
          <option value="">不关联</option>
          {todoTasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </label>

      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] p-4">
        <div className="mb-2 text-sm font-medium">今日专注</div>
        <div className="text-2xl font-semibold text-blue-600">
          {Math.floor(todaySec / 60)} <span className="text-sm font-normal text-[var(--color-muted)]">分钟</span>
        </div>
        <div className="mt-1 text-xs text-[var(--color-muted)]">
          完成 {sessions.filter((s) => s.completed && dayjs(s.startedAt).isSame(dayjs(), 'day')).length} 个番茄
        </div>
        <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-xs text-[var(--color-muted)]">
          {sessions
            .filter((s) => s.completed)
            .slice(-8)
            .reverse()
            .map((s) => {
              const task = tasks.find((t) => t.id === s.taskId)
              return (
                <li key={s.id}>
                  {dayjs(s.startedAt).format('M/D HH:mm')} · {Math.round(s.durationSec / 60)} 分钟
                  {task ? ` · ${task.title}` : ''}
                </li>
              )
            })}
        </ul>
      </div>
    </div>
  )
}
