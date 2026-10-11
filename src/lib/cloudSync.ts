/**
 * 云同步引擎 v2 —— 实体级 LWW + 单调游标（与服务端 /api/sync 对应）。
 *
 * 一致性设计要点（详见 docs/sync-design.md）：
 * 1. 状态基同步：每次全量上送本地实体，天然幂等——请求丢失 / 应用被杀 / 重复发送都无害；
 * 2. LWW：实体以 (updatedAt, deviceId) 为裁决键，双端对任意交错顺序收敛到同一结果；
 * 3. 单调游标：服务端为每用户维护单调递增 seq，客户端只拉增量，断线补拉自愈
 *    （cursor 丢失时从 0 重拉，LWW 保证不产生错误覆盖）；
 * 4. 墓碑：本地删除记录为墓碑实体，跨端传播；服务端长期保留（可由管理员清理）；
 * 5. 单飞 + 防抖：同步串行执行，期间的新改动合并为下一轮；离线时指数退避重试；
 * 6. 应用服务端变更时做结构化等值检查 + 抑制回推，避免同步风暴。
 */
import { useAppStore } from '../store/useAppStore'
import { loadToken } from './auth'
import { getApiBase } from './config'
import { loadMeta, patchMeta, pruneTombstones, saveMeta } from './account'
import { dayjs } from './dates'
import type { CalendarMode, SortBy, Tag, Task, TaskList, ThemeMode } from '../types'

export type SettingsEntity = {
  id: 'app'
  theme: ThemeMode
  sortBy: SortBy
  calendarMode: CalendarMode
  updatedAt: string
}

type EntityChange<T> = {
  type: 'task' | 'list' | 'tag' | 'settings'
  id: string
  updatedAt: string
  deviceId: string
  deleted: boolean
  data: T | null
}

export type SyncRequest = {
  deviceId: string
  cursor: number
  entities: {
    tasks: Task[]
    lists: TaskList[]
    tags: Tag[]
    settings: SettingsEntity[]
  }
}

export type SyncResponse = {
  cursor: number
  serverTime: string
  changes: {
    tasks: EntityChange<Task>[]
    lists: EntityChange<TaskList>[]
    tags: EntityChange<Tag>[]
    settings: EntityChange<SettingsEntity>[]
  }
  result: { applied: number; skippedOlder: number; invalid: number }
}

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'ok'; at: string; cursor: number }
  | { kind: 'offline'; message: string; retryingAt: string | null }
  | { kind: 'auth-expired' }

type StatusListener = (s: SyncStatus) => void
const listeners = new Set<StatusListener>()
let status: SyncStatus = { kind: 'idle' }

export function subscribeSyncStatus(fn: StatusListener): () => void {
  listeners.add(fn)
  fn(status)
  return () => listeners.delete(fn)
}

function setStatus(s: SyncStatus) {
  status = s
  listeners.forEach((fn) => fn(s))
}

export function getSyncStatus(): SyncStatus {
  return status
}

/* ------------------------------------------------------------------ */
/* 出站：本地状态 → 同步请求                                            */
/* ------------------------------------------------------------------ */

export function buildSettingsEntity(userId: string): SettingsEntity {
  const s = useAppStore.getState()
  const meta = loadMeta(userId)
  return {
    id: 'app',
    theme: s.theme,
    sortBy: s.sortBy,
    calendarMode: s.calendarMode,
    updatedAt: meta.settingsUpdatedAt,
  }
}

function tombstoneEntities(userId: string): { tasks: Task[]; lists: TaskList[]; tags: Tag[] } {
  const meta = loadMeta(userId)
  const tasks: Task[] = []
  const lists: TaskList[] = []
  const tags: Tag[] = []
  for (const [key, at] of Object.entries(meta.pendingTombstones)) {
    const [type, id] = key.split(':')
    if (!id) continue
    if (type === 'task') tasks.push({ id, updatedAt: at, deleted: true } as unknown as Task)
    else if (type === 'list') lists.push({ id, updatedAt: at, deleted: true } as unknown as TaskList)
    else if (type === 'tag') tags.push({ id, updatedAt: at, deleted: true } as unknown as Tag)
  }
  return { tasks, lists, tags }
}

function buildRequest(userId: string): SyncRequest {
  const s = useAppStore.getState()
  const meta = pruneTombstones(loadMeta(userId))
  const tombs = tombstoneEntities(userId)
  return {
    deviceId: meta.deviceId,
    cursor: meta.cursor,
    entities: {
      tasks: [...s.tasks, ...tombs.tasks],
      lists: [...s.lists, ...tombs.lists],
      tags: [...s.tags, ...tombs.tags],
      settings: [buildSettingsEntity(userId)],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 入站：服务端变更 → 本地状态（客户端 LWW 守卫）                        */
/* ------------------------------------------------------------------ */

/** 客户端裁决：updatedAt 相同（含并列）时采用服务端——因为服务端已用完整键做过裁决 */
function serverWins(localUpdatedAt: string | undefined, serverUpdatedAt: string): boolean {
  const local = localUpdatedAt ?? ''
  return serverUpdatedAt >= local
}

function sameTask(a: Task, b: Task): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** 应用一轮服务端变更；返回是否有任何实际改动 */
function applyChanges(userId: string, resp: SyncResponse): boolean {
  const { tasks, lists, tags } = useAppStore.getState()
  let changed = false

  // —— 任务 ——
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const nextTasks = [...tasks]
  for (const ch of resp.changes.tasks) {
    const local = taskById.get(ch.id)
    if (ch.deleted) {
      if (local && serverWins(local.updatedAt, ch.updatedAt)) {
        nextTasks.splice(nextTasks.indexOf(local), 1)
        changed = true
      }
      continue
    }
    if (!ch.data) continue
    if (!local) {
      nextTasks.push(ch.data)
      taskById.set(ch.id, ch.data)
      changed = true
    } else if (serverWins(local.updatedAt, ch.updatedAt) && !sameTask(local, ch.data)) {
      nextTasks.splice(nextTasks.indexOf(local), 1, ch.data)
      taskById.set(ch.id, ch.data)
      changed = true
    }
  }

  // —— 清单 ——
  let nextLists = lists
  for (const ch of resp.changes.lists) {
    const local = nextLists.find((l) => l.id === ch.id)
    if (ch.deleted) {
      if (local && serverWins(local.updatedAt, ch.updatedAt)) {
        nextLists = nextLists.filter((l) => l.id !== ch.id)
        changed = true
      }
      continue
    }
    if (!ch.data) continue
    const incoming = ch.data
    if (!local) {
      nextLists = [...nextLists, incoming]
      changed = true
    } else if (serverWins(local.updatedAt, ch.updatedAt) && JSON.stringify(local) !== JSON.stringify(incoming)) {
      nextLists = nextLists.map((l) => (l.id === ch.id ? incoming : l))
      changed = true
    }
  }

  // —— 标签 ——
  let nextTags = tags
  for (const ch of resp.changes.tags) {
    const local = nextTags.find((t) => t.id === ch.id)
    if (ch.deleted) {
      if (local && serverWins(local.updatedAt, ch.updatedAt)) {
        nextTags = nextTags.filter((t) => t.id !== ch.id)
        changed = true
      }
      continue
    }
    if (!ch.data) continue
    const incoming = ch.data
    if (!local) {
      nextTags = [...nextTags, incoming]
      changed = true
    } else if (serverWins(local.updatedAt, ch.updatedAt) && JSON.stringify(local) !== JSON.stringify(incoming)) {
      nextTags = nextTags.map((t) => (t.id === ch.id ? incoming : t))
      changed = true
    }
  }

  // —— 偏好设置 ——
  const settingsCh = resp.changes.settings.find((s) => s.id === 'app')
  const meta0 = loadMeta(userId)
  if (settingsCh?.data && serverWins(meta0.settingsUpdatedAt, settingsCh.updatedAt)) {
    const d = settingsCh.data
    const s = useAppStore.getState()
    const prefsChanged =
      d.theme !== s.theme || d.sortBy !== s.sortBy || d.calendarMode !== s.calendarMode
    if (prefsChanged) {
      applyingRemote = true
      try {
        useAppStore.setState({ theme: d.theme, sortBy: d.sortBy, calendarMode: d.calendarMode })
      } finally {
        applyingRemote = false
      }
    }
    // 采纳服务端偏好逻辑时间，防止下一轮被本地旧值顶回
    patchMeta(userId, { settingsUpdatedAt: settingsCh.updatedAt })
    changed = true
  }

  if (changed) {
    applyingRemote = true
    try {
      useAppStore.setState({ tasks: nextTasks, lists: nextLists, tags: nextTags })
    } finally {
      applyingRemote = false
    }
  }
  return changed
}

/** 首次同步：整体采用服务端状态（丢弃本机种子，绝不参与 LWW——种子的 updatedAt 太新会反噬云端） */
function adoptServerWholesale(uid: string, resp: SyncResponse): void {
  const tasks = resp.changes.tasks.filter((c) => !c.deleted && c.data).map((c) => c.data as Task)
  const lists = resp.changes.lists.filter((c) => !c.deleted && c.data).map((c) => c.data as TaskList)
  const tags = resp.changes.tags.filter((c) => !c.deleted && c.data).map((c) => c.data as Tag)
  applyingRemote = true
  try {
    useAppStore.setState({ tasks, lists, tags })
  } finally {
    applyingRemote = false
  }
  const sCh = resp.changes.settings.find((s) => s.id === 'app')
  if (sCh?.data) {
    applyingRemote = true
    try {
      useAppStore.setState({
        theme: sCh.data.theme,
        sortBy: sCh.data.sortBy,
        calendarMode: sCh.data.calendarMode,
      })
    } finally {
      applyingRemote = false
    }
    patchMeta(uid, { settingsUpdatedAt: sCh.updatedAt })
  } else {
    patchMeta(uid, { settingsUpdatedAt: dayjs().toISOString() })
  }
}

/* ------------------------------------------------------------------ */
/* 引擎主体：单飞 + 防抖 + 退避重试                                     */
/* ------------------------------------------------------------------ */

let userId: string | null = null
let syncing = false
let rerunAfter = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempt = 0
let periodicTimer: ReturnType<typeof setInterval> | null = null
let applyingRemote = false
let hooksRef: { onAuthExpired?: () => void } | null = null

const DEBOUNCE_MS = 1500
const RETRY_STEPS = [5_000, 15_000, 30_000, 60_000]

export function startSyncEngine(
  uid: string,
  hooks?: { onAuthExpired?: () => void },
): () => void {
  userId = uid
  hooksRef = hooks ?? null
  // 账号切换时重置元数据（loadMeta 依据 userId 自动重置）
  loadMeta(uid)
  void runSync()

  const unsub = useAppStore.subscribe((state, prev) => {
    if (applyingRemote || !userId) return

    // 删除检测：本地消失的实体 → 墓碑
    const meta = loadMeta(userId)
    let tombChanged = false
    const tombs = { ...meta.pendingTombstones }
    const groups: [string, readonly { id: string }[], readonly { id: string }[]][] = [
      ['task', prev.tasks, state.tasks],
      ['list', prev.lists, state.lists],
      ['tag', prev.tags, state.tags],
    ]
    for (const [type, before, after] of groups) {
      const afterIds = new Set(after.map((x) => x.id))
      for (const item of before) {
        if (!afterIds.has(item.id)) {
          tombs[`${type}:${item.id}`] = dayjs().toISOString()
          tombChanged = true
        }
      }
    }

    // 偏好变更 → 推进 settings 逻辑时间；数据变更 → 重新上送
    const prefsChanged =
      state.theme !== prev.theme || state.sortBy !== prev.sortBy || state.calendarMode !== prev.calendarMode
    const dataChanged = state.lists !== prev.lists || state.tags !== prev.tags || state.tasks !== prev.tasks

    if (tombChanged || prefsChanged) {
      saveMeta(
        patchMeta(userId, {
          ...(tombChanged ? { pendingTombstones: tombs } : {}),
          ...(prefsChanged ? { settingsUpdatedAt: dayjs().toISOString() } : {}),
        }),
      )
    }
    if (tombChanged || prefsChanged || dataChanged) {
      scheduleSync()
    }
  })

  // 回前台 / 网络恢复 → 立即同步
  const onVisible = () => {
    if (document.visibilityState === 'visible') void runSync()
  }
  const onOnline = () => void runSync()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  periodicTimer = setInterval(() => void runSync(), 60_000)

  return () => {
    unsub()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
    if (periodicTimer) clearInterval(periodicTimer)
    if (debounceTimer) clearTimeout(debounceTimer)
    if (retryTimer) clearTimeout(retryTimer)
    periodicTimer = null
    userId = null
    hooksRef = null
  }
}

/** 本地改动后防抖触发 */
export function scheduleSync(delayMs = DEBOUNCE_MS): void {
  if (!userId) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void runSync(), delayMs)
}

function scheduleRetry(): void {
  if (!userId) return
  const step = RETRY_STEPS[Math.min(retryAttempt, RETRY_STEPS.length - 1)]
  retryAttempt += 1
  const at = dayjs(Date.now() + step).toISOString()
  setStatus({ kind: 'offline', message: '网络不佳，稍后自动重试', retryingAt: at })
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(() => void runSync(), step)
}

/** 单飞同步：期间有新改动会在结束后自动补一轮 */
export async function runSync(): Promise<void> {
  if (!userId) return
  if (syncing) {
    rerunAfter = true
    return
  }
  syncing = true
  setStatus({ kind: 'syncing' })
  const uid = userId
  try {
    const token = loadToken()
    if (!token) throw Object.assign(new Error('unauthorized'), { status: 401 })

    // init 流程：先空推探查服务端是否已有数据，避免本地种子污染云端（见 adoptServerWholesale）
    const init = !loadMeta(uid).initDone
    const req = init
      ? { ...buildRequest(uid), entities: { tasks: [], lists: [], tags: [], settings: [] } }
      : buildRequest(uid)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    let resp: Response
    try {
      resp = await fetch(`${getApiBase()}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(req),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (resp.status === 401) {
      setStatus({ kind: 'auth-expired' })
      hooksRef?.onAuthExpired?.()
      return
    }
    if (!resp.ok) throw Object.assign(new Error(`sync failed (${resp.status})`), { status: resp.status })

    const data = (await resp.json()) as SyncResponse
    const serverHasData =
      data.changes.tasks.length +
        data.changes.lists.length +
        data.changes.tags.length +
        data.changes.settings.length >
      0

    if (init && serverHasData) {
      adoptServerWholesale(uid, data)
    } else {
      applyChanges(uid, data)
    }

    // 墓碑确认：服务端已回送的删除从待发清单移除
    const acked = new Set<string>()
    for (const ch of [
      ...data.changes.tasks,
      ...data.changes.lists,
      ...data.changes.tags,
      ...data.changes.settings,
    ]) {
      if (ch.deleted) acked.add(`${ch.type}:${ch.id}`)
    }
    const meta = loadMeta(uid)
    if (acked.size > 0) {
      const tombs = { ...meta.pendingTombstones }
      for (const key of acked) delete tombs[key]
      patchMeta(uid, { pendingTombstones: tombs })
    }
    patchMeta(uid, {
      cursor: data.cursor,
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
      initDone: true,
    })

    retryAttempt = 0
    setStatus({ kind: 'ok', at: new Date().toISOString(), cursor: data.cursor })

    // init 探查发现服务端为空 → 立即补一轮把本地（种子）推上去
    if (init && !serverHasData) {
      rerunAfter = true
    }
  } catch (e) {
    patchMeta(uid, { lastError: e instanceof Error ? e.message : String(e) })
    scheduleRetry()
  } finally {
    syncing = false
    if (rerunAfter) {
      rerunAfter = false
      scheduleSync(300)
    }
  }
}
