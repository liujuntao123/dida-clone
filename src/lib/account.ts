/**
 * 账户级同步元数据（每账号一份，本地持久化）。
 *
 * cursor            服务端单调游标（seq），本地已见到的最大变更批次
 * deviceId          本机设备标识（LWW 平局裁决 / 日志归因）
 * initDone          首次同步是否完成（完成前：服务端有数据则整体采用）
 * settingsUpdatedAt 偏好设置（主题/排序/日历模式）的本地逻辑时间（settings 实体的 updatedAt）
 * pendingTombstones 待同步的本地删除记录（`${type}:${id}` → 删除时刻）
 */
import { dayjs } from './dates'

const META_KEY = 'dida-account-meta'
const DEVICE_KEY = 'dida-device-id'

export type AccountMeta = {
  userId: string
  deviceId: string
  cursor: number
  initDone: boolean
  settingsUpdatedAt: string
  lastSyncedAt: string | null
  lastError: string | null
  pendingTombstones: Record<string, string>
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function loadMeta(userId: string): AccountMeta {
  let raw: Partial<AccountMeta> | null = null
  try {
    raw = JSON.parse(localStorage.getItem(META_KEY) ?? 'null')
  } catch {
    raw = null
  }
  // 账号切换：旧账号的游标/墓碑全部作废，重新走 init 流程
  if (!raw || raw.userId !== userId) {
    return {
      userId,
      deviceId: getDeviceId(),
      cursor: 0,
      initDone: false,
      settingsUpdatedAt: dayjs().toISOString(),
      lastSyncedAt: null,
      lastError: null,
      pendingTombstones: {},
    }
  }
  return {
    userId,
    deviceId: raw.deviceId || getDeviceId(),
    cursor: typeof raw.cursor === 'number' ? raw.cursor : 0,
    initDone: raw.initDone === true,
    settingsUpdatedAt: raw.settingsUpdatedAt || dayjs().toISOString(),
    lastSyncedAt: raw.lastSyncedAt ?? null,
    lastError: raw.lastError ?? null,
    pendingTombstones: raw.pendingTombstones ?? {},
  }
}

export function saveMeta(meta: AccountMeta): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}

export function patchMeta(userId: string, patch: Partial<AccountMeta>): AccountMeta {
  const next = { ...loadMeta(userId), ...patch }
  saveMeta(next)
  return next
}

export function clearMeta(): void {
  localStorage.removeItem(META_KEY)
}

/** 应用数据本地兜底清理：登出/切换账号时调用 */
export function clearLocalAppData(): void {
  localStorage.removeItem('dida-clone-storage')
  clearMeta()
}

/** 30 天仍未被服务端确认的墓碑放弃重发（服务端仍有记录，防无限膨胀） */
export function pruneTombstones(meta: AccountMeta): AccountMeta {
  const cutoff = dayjs().subtract(30, 'day').valueOf()
  const pruned: Record<string, string> = {}
  let changed = false
  for (const [key, at] of Object.entries(meta.pendingTombstones)) {
    if (dayjs(at).valueOf() < cutoff) {
      changed = true
      continue
    }
    pruned[key] = at
  }
  return changed ? { ...meta, pendingTombstones: pruned } : meta
}
