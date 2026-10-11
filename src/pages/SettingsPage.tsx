import { useEffect, useState, type ReactNode } from 'react'
import {
  Bell,
  Check,
  ChevronDown,
  Cloud,
  Download,
  Info,
  Loader2,
  LogOut,
  MonitorSmartphone,
  Palette,
  Server,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/useAppStore'
import { useToastStore } from '../store/useToastStore'
import { useSessionStore } from '../store/useSessionStore'
import { ensureNotificationPermission } from '../lib/reminders'
import { PageHeader } from '../components/common/PageHeader'
import { authApi, authErrorMessage, loadToken } from '../lib/auth'
import { handleAuthExpired, signOut } from '../lib/session'
import { getApiBase, getApiBaseOverride, isUsingOverride, setApiBaseOverride } from '../lib/config'
import { loadMeta } from '../lib/account'
import { getSyncStatus, runSync, subscribeSyncStatus, type SyncStatus } from '../lib/cloudSync'
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
        : status.kind === 'offline'
          ? '#ee5252'
          : status.kind === 'auth-expired'
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
      return '同步中…'
    case 'ok':
      return '已同步'
    case 'offline':
      return status.retryingAt ? `离线 · ${dayjs(status.retryingAt).format('HH:mm')} 自动重试` : '离线'
    case 'auth-expired':
      return '登录已过期'
  }
}

type SessionInfo = {
  token: string
  createdAt: string
  expiresAt: string
  ipAddress?: string | null
  userAgent?: string | null
}

function deviceLabel(ua: string | null): string {
  if (!ua) return '未知设备'
  if (/Android/i.test(ua)) return /DidA|Capacitor/i.test(ua) ? 'Android App' : 'Android 浏览器'
  if (/iPhone|iPad|iOS/i.test(ua)) return 'iOS'
  if (/Macintosh/i.test(ua)) return 'Mac 浏览器'
  if (/Windows/i.test(ua)) return 'Windows 浏览器'
  if (/Linux/i.test(ua)) return 'Linux 浏览器'
  return '浏览器'
}

/* ---------- 设置页 ---------- */

export function SettingsPage() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const lastListView = useAppStore((s) => s.lastListView)
  const goBack = () => setActiveView(lastListView)
  const showToast = useToastStore((s) => s.show)
  const user = useSessionStore((s) => s.user)

  // —— 通知权限 ——
  const [notif, setNotif] = useState<NotificationPermission | 'unsupported'>('default')

  // —— 同步 ——
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus())
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => (user ? loadMeta(user.id).lastSyncedAt : null),
  )
  const [cursor, setCursor] = useState(() => (user ? loadMeta(user.id).cursor : 0))
  const [syncBusy, setSyncBusy] = useState(false)
  const [serverUrl, setServerUrl] = useState(getApiBaseOverride())
  const [serverSaved, setServerSaved] = useState(false)

  // —— 安全 ——
  const [pwOpen, setPwOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMessage, setPwMessage] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    setNotif('Notification' in window ? Notification.permission : 'unsupported')
    return subscribeSyncStatus((s) => {
      setStatus(s)
      const meta = user ? loadMeta(user.id) : null
      setLastSyncedAt(meta?.lastSyncedAt ?? null)
      setCursor(meta?.cursor ?? 0)
    })
  }, [user])

  const doSync = async () => {
    setSyncBusy(true)
    try {
      await runSync()
      showToast('同步完成')
    } catch {
      showToast('同步失败，将自动重试')
    } finally {
      setSyncBusy(false)
    }
  }

  const saveServerUrl = () => {
    setApiBaseOverride(serverUrl)
    setServerSaved(true)
    showToast('服务地址已保存，重新登录后生效')
    setTimeout(() => setServerSaved(false), 1500)
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

  /* —— 数据导出 —— */
  const exportData = () => {
    const s = useAppStore.getState()
    const payload = {
      exportedAt: new Date().toISOString(),
      account: user?.email ?? null,
      tasks: s.tasks,
      lists: s.lists,
      tags: s.tags,
      prefs: { theme: s.theme, sortBy: s.sortBy, calendarMode: s.calendarMode },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dida-export-${dayjs().format('YYYYMMDD-HHmm')}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('已导出 JSON 文件')
  }

  /* —— 修改密码 —— */
  const changePassword = async () => {
    if (pwBusy) return
    if (newPassword.length < 8) {
      setPwMessage('新密码至少 8 位')
      return
    }
    setPwBusy(true)
    setPwMessage(null)
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      setPwOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      showToast('密码已修改，其他设备已退出')
    } catch (err) {
      const e = err as { status?: number; code?: string }
      setPwMessage(e?.status === 401 ? '当前密码不正确' : authErrorMessage(err))
    } finally {
      setPwBusy(false)
    }
  }

  /* —— 会话管理 —— */
  const loadSessions = async () => {
    try {
      setSessions(await authApi.listSessions())
    } catch (err) {
      showToast(authErrorMessage(err))
    }
  }

  const revokeSession = async (token: string) => {
    setRevoking(token)
    try {
      await authApi.revokeSession({ token })
      await loadSessions()
      showToast('已退出该设备')
    } catch (err) {
      showToast(authErrorMessage(err))
    } finally {
      setRevoking(null)
    }
  }

  /* —— 注销账号 —— */
  const deleteAccount = async () => {
    if (!window.confirm('注销账号将永久删除云端全部数据（任务 / 清单 / 标签 / 会话），且无法恢复。确定继续？')) return
    if (!window.confirm('再次确认：真的要注销吗？')) return
    try {
      const token = loadToken()
      const res = await fetch(`${getApiBase()}/api/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        handleAuthExpired()
        return
      }
      if (!res.ok) throw new Error(`删除失败 (${res.status})`)
      await signOut()
      showToast('账号已注销')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '注销失败，请稍后再试')
    }
  }

  const toggleSessions = () => {
    const next = !sessionsOpen
    setSessionsOpen(next)
    if (next) void loadSessions()
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-surface-2)]">
      <PageHeader title="设置" onBack={goBack} />
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-12 pt-1">
        {/* 账户 */}
        <Section title="账户" icon={<UserRound size={14} strokeWidth={1.75} />}>
          <Row
            icon={<UserRound size={18} strokeWidth={1.75} />}
            title={user?.email ?? '未登录'}
            subtitle={
              user?.role === 'admin' ? '管理员' : undefined
            }
          />
          <Row
            divider
            icon={<Cloud size={18} strokeWidth={1.75} />}
            title={
              <span className="flex items-center gap-2">
                <StatusDot status={status} />
                <span className={cn(status.kind === 'offline' && 'text-red-500')}>{statusTextOf(status)}</span>
              </span>
            }
            subtitle={
              lastSyncedAt
                ? `最近同步 ${dayjs(lastSyncedAt).format('M月D日 HH:mm')} · 版本 ${cursor}`
                : '尚未同步'
            }
            right={
              <button
                type="button"
                disabled={syncBusy}
                className="btn-primary min-h-9 px-3.5 text-xs disabled:opacity-50"
                onClick={() => void doSync()}
              >
                {syncBusy ? <Loader2 size={14} className="animate-spin" /> : '立即同步'}
              </button>
            }
          />
          <Row
            divider
            icon={<Server size={18} strokeWidth={1.75} />}
            title="服务地址"
            right={
              serverSaved ? (
                <span className="flex items-center gap-1 text-xs text-emerald-500">
                  <Check size={14} strokeWidth={2.5} /> 已保存
                </span>
              ) : isUsingOverride() ? (
                <span className="text-xs text-[var(--color-muted)]">自定义</span>
              ) : undefined
            }
          />
          <div className="px-4 pb-3">
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              onBlur={saveServerUrl}
              placeholder="https://dida-clone-sync.xxx.workers.dev（留空用默认）"
              className="field-focus w-full rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-xs outline-none placeholder:text-[var(--color-muted)]/60"
            />
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]/80">
              修改后需退出登录再重新登录。当前使用：{getApiBase() || '同源服务'}
            </p>
          </div>
        </Section>

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

        {/* 数据 */}
        <Section title="数据" icon={<Download size={14} strokeWidth={1.75} />}>
          <Row
            icon={<Download size={18} strokeWidth={1.75} />}
            title="导出数据"
            subtitle="下载全部任务的 JSON 文件"
            onClick={exportData}
          />
        </Section>

        {/* 安全 */}
        <Section title="安全" icon={<ShieldCheck size={14} strokeWidth={1.75} />}>
          <Row
            divider
            icon={<ShieldCheck size={18} strokeWidth={1.75} />}
            title="修改密码"
            subtitle="修改后其他设备将被退出"
            onClick={() => {
              setPwOpen((v) => !v)
              setPwMessage(null)
            }}
            right={
              <ChevronDown
                size={16}
                strokeWidth={2}
                className={cn('text-[var(--color-muted)] transition', !pwOpen && '-rotate-90')}
              />
            }
          />
          {pwOpen && (
            <div className="animate-fade-in space-y-2 px-4 pb-3">
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="当前密码"
                className="field-focus w-full rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)]/60"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="新密码（至少 8 位）"
                className="field-focus w-full rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)]/60"
              />
              {pwMessage && <p className="text-xs text-red-500">{pwMessage}</p>}
              <button
                type="button"
                disabled={pwBusy || !currentPassword || !newPassword}
                className="btn-primary min-h-10 w-full text-sm disabled:opacity-50"
                onClick={() => void changePassword()}
              >
                {pwBusy ? <Loader2 size={15} className="animate-spin" /> : '确认修改'}
              </button>
            </div>
          )}
          <Row
            divider
            icon={<MonitorSmartphone size={18} strokeWidth={1.75} />}
            title="登录设备"
            subtitle={sessions ? `${sessions.length} 个活跃会话` : '查看并远程退出其他设备'}
            onClick={toggleSessions}
            right={
              <ChevronDown
                size={16}
                strokeWidth={2}
                className={cn('text-[var(--color-muted)] transition', !sessionsOpen && '-rotate-90')}
              />
            }
          />
          {sessionsOpen && (
            <div className="animate-fade-in pb-2">
              {sessions === null && (
                <div className="flex justify-center py-3">
                  <Loader2 size={16} className="animate-spin text-[var(--color-muted)]" />
                </div>
              )}
              {sessions?.map((s) => (
                <div key={s.token} className="relative flex items-center gap-3 px-4 py-2.5">
                  <span className="row-divider-line absolute inset-x-0 top-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{deviceLabel(s.userAgent ?? null)}</p>
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      {s.ipAddress || '未知 IP'} · 登录于 {dayjs(s.createdAt).format('M月D日 HH:mm')}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={revoking === s.token}
                    className="min-h-9 rounded-lg px-2.5 text-xs text-red-500 active:opacity-70 disabled:opacity-40"
                    onClick={() => void revokeSession(s.token)}
                  >
                    {revoking === s.token ? <Loader2 size={13} className="animate-spin" /> : '退出'}
                  </button>
                </div>
              ))}
              {sessions?.length === 0 && (
                <p className="px-4 py-3 text-xs text-[var(--color-muted)]">暂无其他会话</p>
              )}
            </div>
          )}
          <Row
            divider
            icon={<LogOut size={18} strokeWidth={1.75} />}
            title="退出登录"
            subtitle="本地数据将清空，云端保留，随时可再登录"
            onClick={() => void signOut()}
          />
          <Row
            divider
            icon={<Trash2 size={18} strokeWidth={1.75} />}
            iconColor="#ee5252"
            title={<span className="text-red-500">注销账号</span>}
            subtitle="永久删除云端全部数据，不可恢复"
            onClick={() => void deleteAccount()}
          />
        </Section>

        {/* 关于 */}
        <Section title="关于" icon={<Info size={14} strokeWidth={1.75} />}>
          <Row title="版本" right={<span className="tnum text-xs text-[var(--color-muted)]">v{__APP_VERSION__}</span>} />
          <Row
            divider
            title="滴答清单复刻"
            subtitle="云端多端同步 · 离线可用 · 实体级冲突合并"
          />
        </Section>
      </div>
    </div>
  )
}
