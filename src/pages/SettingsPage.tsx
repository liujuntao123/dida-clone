import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  Cloud,
  Download,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Palette,
  Upload,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/useAppStore'
import { useToastStore } from '../store/useToastStore'
import { ensureNotificationPermission } from '../lib/reminders'
import { PageHeader } from '../components/common/PageHeader'
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
import type { ThemeMode } from '../types'

/* ---------- 通用小组件 ---------- */

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-2">
      <h2 className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-[var(--color-muted)]">
        {icon}
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-[var(--color-card)]">{children}</div>
    </section>
  )
}

function Row({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  onClick,
  divider,
}: {
  icon?: ReactNode
  iconColor?: string
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  onClick?: () => void
  divider?: boolean
}) {
  const inner = (
    <>
      {divider && <span className="row-divider-line absolute inset-x-0 top-0" />}
      {icon !== undefined && (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center"
          style={{ color: iconColor ?? 'var(--color-muted)' }}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-tight">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-xs text-[var(--color-muted)]">{subtitle}</span>}
      </span>
      {right}
    </>
  )
  const base =
    'relative flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left text-[var(--color-fg)]'
  if (onClick) {
    return (
      <button type="button" className={cn(base, 'active:bg-[var(--color-surface-2)]')} onClick={onClick}>
        {inner}
      </button>
    )
  }
  return <div className={base}>{inner}</div>
}

/** 同步状态圆点 */
function StatusDot({ status }: { status: SyncStatus }) {
  const color =
    status.kind === 'ok'
      ? '#34c759'
      : status.kind === 'syncing'
        ? 'var(--color-brand)'
        : status.kind === 'error'
          ? '#ee5252'
          : status.kind === 'conflict'
            ? '#f5a623'
            : 'var(--color-muted)'
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
      {status.kind === 'syncing' && (
        <span className="absolute h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />
      )}
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  )
}

function statusTextOf(status: SyncStatus): string {
  switch (status.kind) {
    case 'idle':
      return '空闲'
    case 'syncing':
      return status.action === 'pull' ? '拉取中…' : status.action === 'force' ? '强制上传中…' : '上传中…'
    case 'ok':
      return `已同步 · rev ${status.revision}`
    case 'conflict':
      return '有冲突待处理'
    case 'error':
      return `出错：${status.message}`
  }
}

/* ---------- 设置页 ---------- */

export function SettingsPage() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const lastListView = useAppStore((s) => s.lastListView)
  const goBack = () => setActiveView(lastListView)
  const showToast = useToastStore((s) => s.show)

  // —— 通知权限 ——
  const [notif, setNotif] = useState<NotificationPermission | 'unsupported'>('default')

  // —— 同步 ——
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [revision, setRevision] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus())
  const [busy, setBusy] = useState<'sync' | 'pull' | 'push' | 'force' | 'test' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [conflict, setConflict] = useState<{
    remote: { revision: number; state: SyncableState | null }
  } | null>(null)

  useEffect(() => {
    setNotif('Notification' in window ? Notification.permission : 'unsupported')
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

  /** 失焦时若配置有变化则落盘 */
  const persistConfigIfChanged = () => {
    const cfg = loadSyncConfig()
    if (cfg.apiBaseUrl === apiBaseUrl.trim() && cfg.accessKey === accessKey.trim()) return
    saveSyncConfig({ apiBaseUrl: apiBaseUrl.trim(), accessKey: accessKey.trim() })
    showToast('同步配置已保存')
  }

  const run = async (kind: 'sync' | 'pull' | 'push' | 'force', fn: () => Promise<void>, okMsg: string) => {
    setBusy(kind)
    setMessage(null)
    setConflict(null)
    try {
      saveSyncConfig({ apiBaseUrl: apiBaseUrl.trim(), accessKey: accessKey.trim() })
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
        setMessage('云端版本较新，请选择处理方式')
      } else {
        setMessage(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setBusy(null)
    }
  }

  const testConnection = async () => {
    setBusy('test')
    setMessage(null)
    saveSyncConfig({ apiBaseUrl: apiBaseUrl.trim(), accessKey: accessKey.trim() })
    const ok = await healthCheck(apiBaseUrl.trim())
    setMessage(ok ? '连接成功' : '无法连接，请检查地址')
    setBusy(null)
  }

  const requestNotif = async () => {
    const ok = await ensureNotificationPermission()
    setNotif('Notification' in window ? Notification.permission : 'unsupported')
    showToast(ok ? '通知已开启' : '未能开启通知')
  }

  const notifInfo = (() => {
    switch (notif) {
      case 'granted':
        return { text: '已开启', tone: 'text-emerald-500', action: null }
      case 'denied':
        return { text: '已被浏览器拒绝', tone: 'text-[var(--color-muted)]', action: null }
      case 'unsupported':
        return { text: '当前浏览器不支持', tone: 'text-[var(--color-muted)]', action: null }
      default:
        return { text: '未开启', tone: 'text-[var(--color-muted)]', action: 'request' as const }
    }
  })()

  const configured = isSyncConfigured({ ...loadSyncConfig(), apiBaseUrl, accessKey })

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-surface-2)]">
      <PageHeader title="设置" onBack={goBack} />
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-12 pt-1">
        {/* 外观 */}
        <Section title="外观" icon={<Palette size={14} strokeWidth={1.75} />}>
          <div className="flex items-center gap-4 px-4 py-3">
            <div className="flex flex-1 flex-col">
              <span className="text-sm leading-tight">主题</span>
              <span className="mt-0.5 text-xs text-[var(--color-muted)]">{theme === 'light' ? '浅色' : '深色'}</span>
            </div>
            <div className="flex gap-1 rounded-xl bg-[var(--color-surface-2)] p-1">
              {(
                [
                  { id: 'light', label: '浅色' },
                  { id: 'dark', label: '深色' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={theme === id}
                  onClick={() => setTheme(id as ThemeMode)}
                  className={cn(
                    'min-h-9 rounded-lg px-4 text-sm font-medium transition',
                    theme === id
                      ? 'bg-[var(--color-card)] text-[var(--color-fg)] shadow-sm dark:ring-1 dark:ring-white/15'
                      : 'text-[var(--color-muted)]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* 通知 */}
        <Section title="通知" icon={<Bell size={14} strokeWidth={1.75} />}>
          <Row
            icon={<Bell size={18} strokeWidth={1.75} />}
            title="任务到点提醒"
            subtitle="需保持应用在前台运行"
            right={
              notifInfo.action === 'request' ? (
                <button
                  type="button"
                  className="btn-primary min-h-9 px-3.5 text-xs"
                  onClick={() => void requestNotif()}
                >
                  开启
                </button>
              ) : (
                <span className={cn('flex items-center gap-1 text-xs', notifInfo.tone)}>
                  {notif === 'granted' && <Check size={14} strokeWidth={2.5} />}
                  {notifInfo.text}
                </span>
              )
            }
          />
        </Section>

        {/* 云同步 */}
        <Section title="云同步" icon={<Cloud size={14} strokeWidth={1.75} />}>
          <div className="px-4 pb-1 pt-3 text-xs leading-relaxed text-[var(--color-muted)]">
            单用户 self-host：在 Cloudflare Worker 设置 ACCESS_KEY，填入下方地址与密钥即可多端同步。
            密钥仅保存在本机。
          </div>
          <div className="relative px-4 py-2.5">
            <span className="row-divider-line absolute inset-x-4 top-0" />
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--color-muted)]">服务地址</span>
              <input
                type="url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                onBlur={persistConfigIfChanged}
                placeholder="https://dida-clone-sync.xxx.workers.dev"
                className="field-focus w-full rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)]/60"
              />
            </label>
          </div>
          <div className="relative px-4 py-2.5">
            <span className="row-divider-line absolute inset-x-4 top-0" />
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--color-muted)]">访问密钥</span>
              <span className="relative block">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  onBlur={persistConfigIfChanged}
                  placeholder="与 Worker 的 ACCESS_KEY 一致"
                  autoComplete="off"
                  className="field-focus w-full rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 pr-11 text-sm outline-none placeholder:text-[var(--color-muted)]/60"
                />
                <button
                  type="button"
                  aria-label={showKey ? '隐藏密钥' : '显示密钥'}
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--color-muted)] active:opacity-70"
                >
                  {showKey ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                </button>
              </span>
            </label>
          </div>

          {/* 状态行 */}
          <div className="relative flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 text-xs text-[var(--color-muted)]">
            <span className="row-divider-line absolute inset-x-4 top-0" />
            <StatusDot status={status} />
            <span className={cn(status.kind === 'error' && 'text-red-500')}>{statusTextOf(status)}</span>
            <span className="tnum">· rev {revision}</span>
            <span>
              · {lastSyncedAt ? dayjs(lastSyncedAt).format('M月D日 HH:mm') : '尚未同步'}
            </span>
          </div>

          {/* 主操作 */}
          <div className="px-4 pb-2 pt-1">
            <button
              type="button"
              disabled={busy !== null || !configured}
              className="btn-primary min-h-11 w-full text-sm"
              onClick={() => void run('sync', doFullSync, '同步完成')}
            >
              {busy === 'sync' ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> 同步中…
                </>
              ) : !configured ? (
                '填写地址与密钥后同步'
              ) : (
                '立即同步'
              )}
            </button>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy !== null || !apiBaseUrl.trim()}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--color-surface-2)] text-sm text-[var(--color-fg)]/85 active:opacity-80 disabled:opacity-40"
                onClick={() => void testConnection()}
              >
                {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : null}
                测试连接
              </button>
              <button
                type="button"
                aria-expanded={advanced}
                className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-[var(--color-surface-2)] text-sm text-[var(--color-fg)]/85 active:opacity-80"
                onClick={() => setAdvanced((v) => !v)}
              >
                更多操作
                <ChevronDown size={14} strokeWidth={2} className={cn('transition', !advanced && '-rotate-90')} />
              </button>
            </div>
            {message && (
              <p className={cn('mt-2 text-xs', conflict ? 'text-amber-500' : 'text-[var(--color-muted)]')}>{message}</p>
            )}
          </div>

          {/* 高级操作 */}
          {advanced && (
            <div className="animate-fade-in pb-1">
              <Row
                divider
                icon={<Download size={17} strokeWidth={1.75} />}
                title="从云端拉取"
                subtitle="用云端数据覆盖本机"
                right={
                  busy === 'pull' ? (
                    <Loader2 size={16} className="animate-spin text-[var(--color-muted)]" />
                  ) : undefined
                }
                onClick={busy ? undefined : () => void run('pull', doPull, '已从云端拉取')}
              />
              <Row
                divider
                icon={<Upload size={17} strokeWidth={1.75} />}
                title="上传到云端"
                subtitle="把本机数据推送到云端"
                right={
                  busy === 'push' ? (
                    <Loader2 size={16} className="animate-spin text-[var(--color-muted)]" />
                  ) : undefined
                }
                onClick={busy ? undefined : () => void run('push', doPush, '已上传到云端')}
              />
              <Row
                divider
                icon={<AlertTriangle size={17} strokeWidth={1.75} />}
                iconColor="#ee5252"
                title={<span className="text-red-500">强制上传</span>}
                subtitle="无视冲突，用本机覆盖云端"
                right={
                  busy === 'force' ? (
                    <Loader2 size={16} className="animate-spin text-[var(--color-muted)]" />
                  ) : undefined
                }
                onClick={
                  busy
                    ? undefined
                    : () => {
                        if (!window.confirm('强制上传会覆盖云端数据，确定？')) return
                        void run('force', doForcePush, '已强制覆盖云端')
                      }
                }
              />
            </div>
          )}

          {/* 冲突处理 */}
          {conflict && (
            <div className="animate-fade-in mx-3 mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="mb-2 text-xs">云端 revision = {conflict.remote.revision}，请选择：</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary min-h-10 flex-1 text-sm"
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
                  用云端覆盖本机
                </button>
                <button
                  type="button"
                  className="min-h-10 flex-1 rounded-xl border border-amber-500/50 text-sm text-amber-600 active:opacity-80"
                  onClick={() => {
                    setConflict(null)
                    void run('force', doForcePush, '已强制上传本地')
                  }}
                >
                  用本机覆盖云端
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* 关于 */}
        <Section title="关于" icon={<Info size={14} strokeWidth={1.75} />}>
          <Row title="版本" right={<span className="tnum text-xs text-[var(--color-muted)]">v{__APP_VERSION__}</span>} />
          <Row
            divider
            title="滴答清单复刻"
            subtitle="本地优先 · 数据存于本机，可选用云同步"
          />
        </Section>
      </div>
    </div>
  )
}
