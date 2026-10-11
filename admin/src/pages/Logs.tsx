import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { RefreshCw } from 'lucide-react'
import { api, type AuditLogRow, type SyncLogRow } from '../api'
import { Badge, EmptyRow, Page, Spinner } from '../ui'

const PAGE_SIZE = 50

function fmtDetail(raw: string | null): string {
  if (!raw) return '-'
  try {
    return JSON.stringify(JSON.parse(raw))
  } catch {
    return raw
  }
}

/** 日志：同步流水（每请求一行，含推送/接受/拉取计数）+ 审计（注册 / 登录 / 管理操作） */
export function Logs() {
  const [tab, setTab] = useState<'sync' | 'audit'>('sync')
  const [syncRows, setSyncRows] = useState<SyncLogRow[] | null>(null)
  const [auditRows, setAuditRows] = useState<AuditLogRow[] | null>(null)
  const [page, setPage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (p: number) => {
    setRefreshing(true)
    setError(null)
    try {
      if (tab === 'sync') setSyncRows((await api.syncLogs(p * PAGE_SIZE, PAGE_SIZE)).logs)
      else setAuditRows((await api.auditLogs(p * PAGE_SIZE, PAGE_SIZE)).logs)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setRefreshing(false)
    }
  }, [tab])

  useEffect(() => {
    setPage(0)
  }, [tab])

  useEffect(() => {
    void load(page)
  }, [load, page])

  const rows = tab === 'sync' ? syncRows : auditRows
  const hasMore = rows !== null && rows.length === PAGE_SIZE

  return (
    <Page
      title="日志"
      sub="同步流水保留 90 天；审计记录注册 / 登录 / 管理操作"
      actions={
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--line)] bg-white p-0.5 text-xs">
            {(
              [
                ['sync', '同步日志'],
                ['audit', '审计日志'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={`rounded-md px-3 py-1.5 font-medium ${tab === id ? 'bg-[var(--brand)] text-white' : 'text-[var(--muted)]'}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="btn px-2.5" onClick={() => void load(page)} disabled={refreshing}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : undefined} /> 刷新
          </button>
        </div>
      }
    >
      <div className="card overflow-x-auto">
        {rows === null ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-[var(--muted)]">
            <Spinner /> 加载中…
          </div>
        ) : tab === 'sync' ? (
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
                <th className="px-4 py-2.5 font-medium">时间</th>
                <th className="px-3 py-2.5 font-medium">用户</th>
                <th className="px-3 py-2.5 font-medium">设备</th>
                <th className="px-3 py-2.5 text-right font-medium">推送</th>
                <th className="px-3 py-2.5 text-right font-medium">接受</th>
                <th className="px-3 py-2.5 text-right font-medium">跳过</th>
                <th className="px-3 py-2.5 text-right font-medium">拉取</th>
                <th className="px-3 py-2.5 text-right font-medium">耗时</th>
                <th className="px-3 py-2.5 font-medium">游标</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {syncRows!.length === 0 && <EmptyRow colSpan={10} text={error ?? '暂无日志'} />}
              {syncRows!.map((l) => (
                <tr key={l.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="tnum whitespace-nowrap px-4 py-2">{dayjs(l.created_at).format('M-D HH:mm:ss')}</td>
                  <td className="max-w-40 truncate px-3 py-2">{l.email ?? l.user_id.slice(0, 8)}</td>
                  <td className="max-w-24 truncate px-3 py-2">{l.device_id || '-'}</td>
                  <td className="tnum px-3 py-2 text-right">{l.pushed}</td>
                  <td className="tnum px-3 py-2 text-right">{l.applied}</td>
                  <td className="tnum px-3 py-2 text-right text-[var(--muted)]">{l.skipped}</td>
                  <td className="tnum px-3 py-2 text-right">{l.pulled}</td>
                  <td className="tnum px-3 py-2 text-right">{l.duration_ms}ms</td>
                  <td className="tnum px-3 py-2 text-[var(--muted)]">
                    {l.seq_from}→{l.seq_to}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={l.status === 'ok' ? 'ok' : 'danger'}>{l.status === 'ok' ? '正常' : l.error || '异常'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[680px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
                <th className="px-4 py-2.5 font-medium">时间</th>
                <th className="px-3 py-2.5 font-medium">用户</th>
                <th className="px-3 py-2.5 font-medium">动作</th>
                <th className="px-3 py-2.5 font-medium">详情</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {auditRows!.length === 0 && <EmptyRow colSpan={5} text={error ?? '暂无日志'} />}
              {auditRows!.map((l) => (
                <tr key={l.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="tnum whitespace-nowrap px-4 py-2">{dayjs(l.created_at).format('M-D HH:mm:ss')}</td>
                  <td className="max-w-44 truncate px-3 py-2">{l.email ?? '-'}</td>
                  <td className="px-3 py-2">
                    <ActionBadge action={l.action} />
                  </td>
                  <td className="max-w-72 truncate px-3 py-2 font-mono text-[11px] text-[var(--muted)]">{fmtDetail(l.detail)}</td>
                  <td className="px-4 py-2">{l.ip || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-xs text-[var(--muted)]">
        <button className="btn px-2 py-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          上一页
        </button>
        <span>第 {page + 1} 页</span>
        <button className="btn px-2 py-1" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
          下一页
        </button>
      </div>
    </Page>
  )
}

function ActionBadge({ action }: { action: string }) {
  const tone = action.startsWith('admin')
    ? 'warn'
    : action.includes('failed')
      ? 'danger'
      : action.startsWith('auth')
        ? 'ok'
        : 'muted'
  const label: Record<string, string> = {
    'auth.register': '注册',
    'auth.login': '登录',
    'auth.login_failed': '登录失败',
    'auth.logout': '登出',
    'auth.password_changed': '改密',
    'account.deleted': '注销账号',
  }
  return <Badge tone={tone as 'warn' | 'danger' | 'ok' | 'muted'}>{label[action] ?? action}</Badge>
}
