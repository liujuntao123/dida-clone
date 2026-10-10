import { useAppStore } from '../store/useAppStore'
import type { SyncableState } from './sync'
import {
  fullSync,
  pullAndApply,
  pushLocal,
  schedulePush,
  SyncConflictError,
} from './sync'
import { isSyncConfigured, saveSyncConfig } from './syncConfig'

export function getSyncableState(): SyncableState {
  const s = useAppStore.getState()
  return {
    lists: s.lists,
    tags: s.tags,
    tasks: s.tasks,
    sessions: [], // pomodoro removed; keep field for Worker protocol
    theme: s.theme,
    sortBy: s.sortBy,
    boardGroupBy: s.boardGroupBy,
    calendarMode: s.calendarMode,
    notifiedReminders: s.notifiedReminders,
  }
}

export function applySyncableState(state: SyncableState) {
  useAppStore.setState({
    lists: state.lists ?? [],
    tags: state.tags ?? [],
    tasks: state.tasks ?? [],
    theme: state.theme ?? 'dark',
    sortBy: state.sortBy ?? 'due',
    boardGroupBy: state.boardGroupBy ?? 'priority',
    calendarMode: state.calendarMode ?? 'month',
    notifiedReminders: state.notifiedReminders ?? [],
  })
}

export async function doPull() {
  await pullAndApply(applySyncableState)
}

export async function doPush() {
  await pushLocal(getSyncableState, applySyncableState)
}

export async function doForcePush() {
  await pushLocal(getSyncableState, applySyncableState, { force: true })
}

export async function doFullSync() {
  await fullSync(getSyncableState, applySyncableState)
}

export function applyRemoteOverwrite(remote: SyncableState, revision: number) {
  applySyncableState(remote)
  saveSyncConfig({
    revision,
    lastSyncedAt: new Date().toISOString(),
    lastError: null,
  })
}

/** Call once on app start: pull if configured; subscribe to local changes. */
export function startSyncRuntime(): () => void {
  if (isSyncConfigured()) {
    void doPull().catch(() => {
      /* status surfaced via subscribeSyncStatus */
    })
  }

  // Debounce upload when persisted fields change
  const unsub = useAppStore.subscribe((state, prev) => {
    if (!isSyncConfigured()) return
    const keys = [
      'lists',
      'tags',
      'tasks',
      'theme',
      'sortBy',
      'boardGroupBy',
      'calendarMode',
      'notifiedReminders',
    ] as const
    const changed = keys.some((k) => state[k] !== prev[k])
    if (changed) {
      schedulePush(getSyncableState, applySyncableState)
    }
  })

  return unsub
}

export { SyncConflictError }
