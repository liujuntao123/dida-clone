import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { api, type AdminStats, type SyncLogRow } from '../api'
import { Badge, Page, Spinner, StatCard } from '../ui'

/** 总览：核心指标 + 近 7 天同步量 + 最近同步流水 */
export function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recent, setRecent] = useState<SyncLogRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [s, logs] = await Promise.all([api.stats(), api.syncLogs(0, 8)])
        setStats(s)
        setRecent(logs.logs)
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败')
      }
    })()
  }, [])

  if (error) {
    return (
      <Page title="总览">
        <p className="card p-6 text-center text-sm text-red-500">{error}</p>
      </Page>
    )
  }
  if (!stats) {
    return (
      <Page title="总览">
        <div className="card flex items-center justify-center gap-2 p-10 text-sm text-[var(--muted)]">
          <Spinner /> 加载中…
        </div>
      </Page>
    )
  }

  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.syncs))
  const taskCount = stats.entities.task ?? 0

  return (
    <Page title="总览" sub={stats.lastSyncAt ? `最近同步活动 ${dayjs(stats.lastSyncAt).format('M月D日 HH:mm:ss')}` : '尚无同步活动'}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="用户数" value={stats.users} sub={`活跃会话 ${stats.activeSessions}`} />
        <StatCard label="任务总数" value={taskCount} sub={`清单 ${stats.entities.list ?? 0} · 标签 ${stats.entities.tag ?? 0}`} />
        <StatCard label="今日同步" value={stats.syncsToday} sub={`近 7 天错误 ${stats.errors7d}`} />
        <StatCard
          label="近 7 天同步量"
          value={stats.daily.reduce((a, d) => a + d.syncs, 0)}
          sub={`推送 ${stats.daily.reduce((a, d) => a + d.applied, 0)} 项变更`}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        <div className="card p-4 lg:col-span-3">
          <h2 className="mb-4 text-sm font-medium">近 7 天同步量</h2>
          {stats.daily.length === 0 ? (
            <p className="py-10 text-center text-xs text-[var(--muted)]">暂无数据</p>
          ) : (
            <div className="flex h-40 items-end gap-2">
              {stats.daily.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="tnum text-[10px] text-[var(--muted)]">{d.syncs}</span>
                  <div
                    className="w-full max-w-10 rounded-t-md bg-[var(--brand)]/85"
                    style={{ height: `${Math.max(4, (d.syncs / maxDaily) * 110)}px` }}
                    title={`${d.day}：同步 ${d.syncs} 次，接受 ${d.applied} 项，拉取 ${d.pulled} 项`}
                  />
                  <span className="text-[10px] text-[var(--muted)]">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium">最近同步</h2>
          <div className="space-y-2.5">
            {recent.length === 0 && <p className="py-6 text-center text-xs text-[var(--muted)]">暂无数据</p>}
            {recent.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate">{l.email ?? l.user_id.slice(0, 8)}</p>
                  <p className="tnum truncate text-[11px] text-[var(--muted)]">
                    {dayjs(l.created_at).format('HH:mm:ss')} · 推{l.pushed}/收{l.pulled} · {l.device_id ?? '-'}
                  </p>
                </div>
                <Badge tone={l.status === 'ok' ? 'ok' : 'danger'}>{l.status === 'ok' ? '正常' : '异常'}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  )
}
