import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ensureNotificationPermission } from '../lib/reminders'
import { LIST_COLORS } from '../lib/constants'
import { PageHeader } from '../components/common/PageHeader'
import { ThemeToggle } from '../components/common/ThemeToggle'
import { loadSyncConfig, saveSyncConfig, isSyncConfigured } from '../lib/syncConfig'
import {
  subscribeSyncStatus,
  getSyncStatus,
  healthCheck,
  type SyncStatus,
} from '../lib/sync'
import {
  doPull,
  doPush,
  doForcePush,
  doFullSync,
  applyRemoteOverwrite,
  SyncConflictError,
} from '../lib/syncBridge'
import type { SyncableState } from '../lib/sync'
import dayjs from 'dayjs'

export function SettingsPage() {
  const lists = useAppStore((s) => s.lists)
  const updateList = useAppStore((s) => s.updateList)
  const deleteList = useAppStore((s) => s.deleteList)
  const tags = useAppStore((s) => s.tags)
  const deleteTag = useAppStore((s) => s.deleteTag)
  const theme = useAppStore((s) => s.theme)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const lastListView = useAppStore((s) => s.lastListView)

  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [revision, setRevision] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{
    remote: { revision: number; state: SyncableState | null }
  } | null>(null)

  useEffect(() => {
    const cfg = loadSyncConfig()
    setApiBaseUrl(cfg.apiBaseUrl)
    setAccessKey(cfg.accessKey)
    setRevision(cfg.revision)
    setLastSyncedAt(cfg.lastSyncedAt)
    return subscribeSyncStatus((s) => {
      setStatus(s)
      const latest = loadSyncConfig()
      setRevision(latest.revision)
      setLastSyncedAt(latest.lastSyncedAt)
    })
  }, [])

  const persistConfig = () => {
    saveSyncConfig({
      apiBaseUrl: apiBaseUrl.trim(),
      accessKey: accessKey.trim(),
    })
    setMessage('已保存同步配置（仅存本机）')
  }

  const run = async (fn: () => Promise<void>, okMsg: string) => {
    setBusy(true)
    setMessage(null)
    setConflict(null)
    try {
      persistConfig()
      await fn()
      const cfg = loadSyncConfig()
      setRevision(cfg.revision)
      setLastSyncedAt(cfg.lastSyncedAt)
      setMessage(okMsg)
    } catch (e) {
      if (e instanceof SyncConflictError) {
        setConflict({
          remote: { revision: e.remote.revision, state: e.remote.state as SyncableState | null },
        })
        setMessage('检测到冲突：云端版本较新')
      } else {
        setMessage(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setBusy(false)
    }
  }

  const statusText = (() => {
    switch (status.kind) {
      case 'idle':
        return '空闲'
      case 'syncing':
        return status.action === 'pull' ? '拉取中…' : status.action === 'force' ? '强制上传中…' : '上传中…'
      case 'ok':
        return `已同步 · rev ${status.revision}`
      case 'conflict':
        return '冲突'
      case 'error':
        return `错误：${status.message}`
    }
  })()

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-surface-2)]">
      <PageHeader title="设置" onBack={() => setActiveView(lastListView)} />
      <div
        className="flex-1 overflow-y-auto p-4 md:p-6"
      >
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--color-muted)]">外观</h2>
        <div className="flex min-h-11 items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <span className="text-sm">当前主题：{theme === 'light' ? '浅色' : '深色'}</span>
          <ThemeToggle />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--color-muted)]">云同步（Cloudflare）</h2>
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs text-[var(--color-muted)]">
            单用户 self-host：在 Cloudflare Worker 设置 ACCESS_KEY，下方填入 API 地址与密钥即可多端同步。
            密钥仅保存在本机 localStorage，不会写入 Git。
          </p>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-muted)]">Sync API Base URL</span>
            <input
              type="url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://dida-clone-sync.xxx.workers.dev"
              className="field-focus w-full rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-muted)]">Access Key</span>
            <input
              type="password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="与 Worker 的 ACCESS_KEY 一致"
              autoComplete="off"
              className="field-focus w-full rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
            <span>状态：{statusText}</span>
            <span>·</span>
            <span>revision：{revision}</span>
            <span>·</span>
            <span>
              上次同步：
              {lastSyncedAt ? dayjs(lastSyncedAt).format('YYYY-MM-DD HH:mm:ss') : '尚未同步'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm active:opacity-80 disabled:opacity-50"
              onClick={() => {
                persistConfig()
                setMessage('已保存')
              }}
            >
              保存配置
            </button>
            <button
              type="button"
              disabled={busy || !apiBaseUrl.trim()}
              className="min-h-11 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm active:opacity-80 disabled:opacity-50"
              onClick={() =>
                void (async () => {
                  setBusy(true)
                  const ok = await healthCheck(apiBaseUrl.trim())
                  setMessage(ok ? '健康检查通过' : '健康检查失败（无法连通）')
                  setBusy(false)
                })()
              }
            >
              测试连接
            </button>
            <button
              type="button"
              disabled={busy || !isSyncConfigured({ ...loadSyncConfig(), apiBaseUrl, accessKey })}
              className="min-h-11 rounded-xl bg-brand px-3 py-2 text-sm text-white hover:bg-brand-hover disabled:opacity-50"
              onClick={() => void run(doFullSync, '立即同步完成')}
            >
              立即同步
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm active:opacity-80 disabled:opacity-50"
              onClick={() => void run(doPull, '已从云端拉取')}
            >
              拉取
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm active:opacity-80 disabled:opacity-50"
              onClick={() => void run(doPush, '已上传到云端')}
            >
              上传
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-xl border border-amber-500/50 px-3 py-2 text-sm text-amber-600 active:opacity-80 disabled:opacity-50"
              onClick={() => {
                if (!confirm('强制上传会覆盖云端数据，确定？')) return
                void run(doForcePush, '已强制覆盖云端')
              }}
            >
              强制上传
            </button>
          </div>
          {message && (
            <p className="text-xs text-[var(--color-muted)]">{message}</p>
          )}
          {conflict && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="mb-2">云端 revision = {conflict.remote.revision}，请选择：</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-brand px-3 py-2 text-white hover:bg-brand-hover"
                  onClick={() => {
                    if (conflict.remote.state) {
                      applyRemoteOverwrite(conflict.remote.state, conflict.remote.revision)
                      setRevision(conflict.remote.revision)
                      setLastSyncedAt(new Date().toISOString())
                      setMessage('已采用云端数据')
                    }
                    setConflict(null)
                  }}
                >
                  用云端
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-amber-700"
                  onClick={() => {
                    setConflict(null)
                    void run(doForcePush, '已强制上传本地')
                  }}
                >
                  强制上传本地
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--color-muted)]">通知</h2>
        <button
          type="button"
          className="min-h-11 rounded-xl bg-brand px-4 py-2 text-sm text-white hover:bg-brand-hover"
          onClick={() => void ensureNotificationPermission()}
        >
          请求浏览器通知权限
        </button>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          任务到点提醒依赖 Notification API；需保持页面打开。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--color-muted)]">清单管理</h2>
        <ul className="space-y-2">
          {lists.map((l) => (
            <li key={l.id} className="flex min-h-11 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5">
              <input
                type="color"
                value={l.color}
                disabled={!!l.isInbox}
                onChange={(e) => updateList(l.id, { color: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded"
                list="list-colors"
              />
              <input
                value={l.name}
                disabled={!!l.isInbox}
                onChange={(e) => updateList(l.id, { name: e.target.value })}
                className="flex-1 bg-transparent text-sm outline-none disabled:opacity-60"
              />
              {!l.isInbox && (
                <button type="button" className="text-xs text-red-500" onClick={() => deleteList(l.id)}>
                  删除
                </button>
              )}
            </li>
          ))}
        </ul>
        <datalist id="list-colors">
          {LIST_COLORS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-muted)]">标签管理</h2>
        <ul className="space-y-2">
          {tags.map((t) => (
            <li key={t.id} className="flex min-h-11 items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm">
              <span style={{ color: t.color }}>#{t.name}</span>
              <button type="button" className="text-xs text-red-500" onClick={() => deleteTag(t.id)}>
                删除
              </button>
            </li>
          ))}
        </ul>
      </section>
      </div>
    </div>
  )
}
