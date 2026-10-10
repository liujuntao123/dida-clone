const STORAGE_KEY = 'dida-clone-sync-config'

export type SyncConfig = {
  apiBaseUrl: string
  accessKey: string
  revision: number
  lastSyncedAt: string | null
  lastError: string | null
}

const DEFAULT: SyncConfig = {
  apiBaseUrl: '',
  accessKey: '',
  revision: 0,
  lastSyncedAt: null,
  lastError: null,
}

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT }
    return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveSyncConfig(patch: Partial<SyncConfig>): SyncConfig {
  const next = { ...loadSyncConfig(), ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function isSyncConfigured(cfg = loadSyncConfig()): boolean {
  return Boolean(cfg.apiBaseUrl.trim() && cfg.accessKey.trim())
}
