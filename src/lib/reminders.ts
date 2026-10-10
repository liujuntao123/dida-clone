import { dayjs } from './dates'
import type { Task } from '../types'

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function showTaskNotification(task: Task) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification('任务提醒', {
      body: task.title,
      tag: `dida-remind-${task.id}`,
      icon: '/favicon.svg',
    })
  } catch {
    // ignore (e.g. insecure context)
  }
}

/** Poll due reminders; returns ids that were fired */
export function checkDueReminders(
  tasks: Task[],
  alreadyNotified: string[],
): string[] {
  const now = dayjs()
  const fired: string[] = []
  for (const t of tasks) {
    if (t.status !== 'todo' || !t.remindAt) continue
    if (alreadyNotified.includes(t.id)) continue
    if (dayjs(t.remindAt).isBefore(now) || dayjs(t.remindAt).isSame(now, 'minute')) {
      showTaskNotification(t)
      fired.push(t.id)
    }
  }
  return fired
}
