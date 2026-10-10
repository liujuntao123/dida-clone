import { loadSyncConfig, saveSyncConfig, isSyncConfigured } from './syncConfig'
import type { PomodoroSession, Tag, Task, TaskList, ThemeMode, SortBy, BoardGroupBy, CalendarMode } from '../types'

/** Persisted app payload that mirrors Zustand partialize fields */
export type SyncableState = {
  lists: TaskList[]
  tags: Tag[]
  tasks: Task[]
  sessions: PomodoroSession[]
  theme: ThemeMode
  sortBy: SortBy
  boardGroupBy: BoardGroupBy
  calendarMode: CalendarMode
  notifiedReminders: string[]
}

export type RemoteStateResponse = {
  revision: number
  updatedAt: string | null
  state: SyncableState | null
  error?: string
  message?: string
}

export class SyncConflictError extends Error {
  remote: RemoteStateResponse
  constructor(remote: RemoteStateResponse) {
    super(remote.message || 'Conflict')
    this.name = 'SyncConflictError'
    this.remote = remote
  }
}

function authHeaders(accessKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessKey}`,
    'Content-Type': 'application/json',
  }
}

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, '')
}

export async function healthCheck(apiBaseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${normalizeBase(apiBaseUrl)}/api/health`)
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return Boolean(data.ok)
  } catch {
    return false
  }
}

export async function fetchRemoteState(
  apiBaseUrl: string,
  accessKey: string,
): Promise<RemoteStateResponse> {
  const res = await fetch(`${normalizeBase(apiBaseUrl)}/api/state`, {
    headers: authHeaders(accessKey),
  })
  const data = (await res.json()) as RemoteStateResponse
  if (res.status === 401) throw new Error('鉴权失败：Access Key 不正确')
  if (!res.ok) throw new Error(data.error || `拉取失败 (${res.status})`)
  return data
}

export async function putRemoteState(
  apiBaseUrl: string,
  accessKey: string,
  state: SyncableState,
  revision: number,
): Promise<RemoteStateResponse> {
  const res = await fetch(`${normalizeBase(apiBaseUrl)}/api/state`, {
    method: 'PUT',
    headers: authHeaders(accessKey),
    body: JSON.stringify({ revision, state }),
  })
  const data = (await res.json()) as RemoteStateResponse
  if (res.status === 401) throw new Error('鉴权失败：Access Key 不正确')
  if (res.status === 409) throw new SyncConflictError(data)
  if (!res.ok) throw new Error(data.error || `上传失败 (${res.status})`)
  return data
}

export async function forcePutRemoteState(
  apiBaseUrl: string,
  accessKey: string,
  state: SyncableState,
): Promise<RemoteStateResponse> {
  const res = await fetch(`${normalizeBase(apiBaseUrl)}/api/state/force`, {
    method: 'POST',
    headers: authHeaders(accessKey),
    body: JSON.stringify({ state }),
  })
  const data = (await res.json()) as RemoteStateResponse
  if (res.status === 401) throw new Error('鉴权失败：Access Key 不正确')
  if (!res.ok) throw new Error(data.error || `强制上传失败 (${res.status})`)
  return data
}

export type ApplyRemoteFn = (state: SyncableState) => void
export type GetLocalFn = () => SyncableState

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let syncing = false
let pendingUpload = false

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing'; action: 'pull' | 'push' | 'force' }
  | { kind: 'ok'; at: string; revision: number }
  | { kind: 'conflict'; remote: RemoteStateResponse }
  | { kind: 'error'; message: string }

type StatusListener = (s: SyncStatus) => void
const listeners = new Set<StatusListener>()
let currentStatus: SyncStatus = { kind: 'idle' }

export function subscribeSyncStatus(fn: StatusListener): () => void {
  listeners.add(fn)
  fn(currentStatus)
  return () => listeners.delete(fn)
}

function setStatus(s: SyncStatus) {
  currentStatus = s
  listeners.forEach((fn) => fn(s))
}

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

export async function pullAndApply(apply: ApplyRemoteFn): Promise<void> {
  const cfg = loadSyncConfig()
  if (!isSyncConfigured(cfg)) return
  if (syncing) {
    pendingUpload = true
    return
  }
  syncing = true
  setStatus({ kind: 'syncing', action: 'pull' })
  try {
    const remote = await fetchRemoteState(cfg.apiBaseUrl, cfg.accessKey)
    if (remote.state) {
      apply(remote.state)
    }
    saveSyncConfig({
      revision: remote.revision,
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
    })
    setStatus({
      kind: 'ok',
      at: new Date().toISOString(),
      revision: remote.revision,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    saveSyncConfig({ lastError: message })
    setStatus({ kind: 'error', message })
    throw e
  } finally {
    syncing = false
    if (pendingUpload) {
      pendingUpload = false
    }
  }
}

export async function pushLocal(
  getLocal: GetLocalFn,
  _apply: ApplyRemoteFn,
  opts?: { force?: boolean },
): Promise<void> {
  const cfg = loadSyncConfig()
  if (!isSyncConfigured(cfg)) return
  if (syncing) {
    pendingUpload = true
    return
  }
  syncing = true
  setStatus({ kind: 'syncing', action: opts?.force ? 'force' : 'push' })
  try {
    const state = getLocal()
    const remote = opts?.force
      ? await forcePutRemoteState(cfg.apiBaseUrl, cfg.accessKey, state)
      : await putRemoteState(cfg.apiBaseUrl, cfg.accessKey, state, cfg.revision)
    saveSyncConfig({
      revision: remote.revision,
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
    })
    setStatus({
      kind: 'ok',
      at: new Date().toISOString(),
      revision: remote.revision,
    })
  } catch (e) {
    if (e instanceof SyncConflictError) {
      setStatus({ kind: 'conflict', remote: e.remote })
      saveSyncConfig({ lastError: '冲突：云端版本较新' })
      throw e
    }
    const message = e instanceof Error ? e.message : String(e)
    saveSyncConfig({ lastError: message })
    setStatus({ kind: 'error', message })
    throw e
  } finally {
    syncing = false
  }
}

/** Debounced upload after local changes (default 2s). */
export function schedulePush(getLocal: GetLocalFn, apply: ApplyRemoteFn, delayMs = 2000) {
  if (!isSyncConfigured()) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void pushLocal(getLocal, apply).catch(() => {
      /* status already set */
    })
  }, delayMs)
}

export async function fullSync(getLocal: GetLocalFn, apply: ApplyRemoteFn): Promise<void> {
  const cfg = loadSyncConfig()
  if (!isSyncConfigured(cfg)) return
  // Pull first; if remote empty and local has data, push
  await pullAndApply(apply)
  const after = loadSyncConfig()
  const remote = await fetchRemoteState(cfg.apiBaseUrl, cfg.accessKey)
  if ((!remote.state || remote.revision === 0) && getLocal().tasks.length > 0) {
    await pushLocal(getLocal, apply, { force: true })
  } else if (after.revision === 0 && getLocal().tasks.length > 0) {
    await pushLocal(getLocal, apply)
  }
}
