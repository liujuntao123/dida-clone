import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Ban, Search, Trash2, Undo2 } from 'lucide-react'
import { api, type AdminUserRow } from '../api'
import { Badge, EmptyRow, Page, Spinner } from '../ui'

const PAGE_SIZE = 20

/** 用户管理：搜索 / 封禁 / 解封 / 删除（调用 better-auth admin 端点） */
export function Users({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<AdminUserRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (p: number, keyword: string) => {
    setRows(null)
    setError(null)
    try {
      const res = await api.users({ q: keyword, limit: PAGE_SIZE, offset: p * PAGE_SIZE })
      setRows(res.users)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
  }, [])

  useEffect(() => {
    void load(page, query)
  }, [load, page, query])

  const act = async (row: AdminUserRow, action: 'ban' | 'unban' | 'remove') => {
    if (busyId) return
    if (action === 'ban') {
      const reason = window.prompt(`封禁 ${row.email}，请输入原因（可留空）：`) ?? ''
      if (reason === null) return
    }
    if (action === 'remove' && !window.confirm(`删除用户 ${row.email} 及其全部云端数据？此操作不可恢复。`)) return
    setBusyId(row.id)
    try {
      if (action === 'ban') await api.banUser(row.id)
      else if (action === 'unban') await api.unbanUser(row.id)
      else await api.removeUser(row.id)
      await load(page, query)
      onChanged?.()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Page
      title="用户"
      sub={`共 ${total} 个账号`}
      actions={
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(0)
            setQuery(q.trim())
          }}
        >
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            className="input w-60 pl-8"
            placeholder="搜索邮箱 / 名称"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
      }
    >
      <div className="card overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
              <th className="px-4 py-2.5 font-medium">用户</th>
              <th className="px-3 py-2.5 font-medium">角色</th>
              <th className="px-3 py-2.5 text-right font-medium">任务</th>
              <th className="px-3 py-2.5 text-right font-medium">实体</th>
              <th className="px-3 py-2.5 text-right font-medium">会话</th>
              <th className="px-3 py-2.5 font-medium">最近同步</th>
              <th className="px-3 py-2.5 font-medium">注册时间</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={8} className="py-10 text-center">
                  <Spinner />
                </td>
              </tr>
            )}
            {rows !== null && rows.length === 0 && <EmptyRow colSpan={8} text={error ?? '没有匹配的用户'} />}
            {rows?.map((u) => (
              <tr key={u.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{u.email}</p>
                  <p className="text-xs text-[var(--muted)]">{u.name}</p>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1">
                    <Badge tone={u.role === 'admin' ? 'brand' : 'muted'}>{u.role === 'admin' ? '管理员' : '用户'}</Badge>
                    {!!u.banned && <Badge tone="danger">已封禁</Badge>}
                  </div>
                </td>
                <td className="tnum px-3 py-2.5 text-right">{u.tasks}</td>
                <td className="tnum px-3 py-2.5 text-right">{u.entities}</td>
                <td className="tnum px-3 py-2.5 text-right">{u.sessions}</td>
                <td className="px-3 py-2.5 text-xs">
                  {u.lastSyncAt ? dayjs(u.lastSyncAt).format('M月D日 HH:mm') : <span className="text-[var(--muted)]">从未</span>}
                </td>
                <td className="px-3 py-2.5 text-xs">{dayjs(u.createdAt).format('YYYY-M-D')}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    {u.banned ? (
                      <button className="btn px-2 py-1 text-xs" disabled={busyId === u.id} onClick={() => void act(u, 'unban')}>
                        <Undo2 size={13} /> 解封
                      </button>
                    ) : (
                      <button className="btn px-2 py-1 text-xs" disabled={busyId === u.id} onClick={() => void act(u, 'ban')}>
                        <Ban size={13} /> 封禁
                      </button>
                    )}
                    <button
                      className="btn btn-danger px-2 py-1 text-xs"
                      disabled={busyId === u.id}
                      onClick={() => void act(u, 'remove')}
                    >
                      <Trash2 size={13} /> 删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-[var(--muted)]">
          <button className="btn px-2 py-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            上一页
          </button>
          <span className="tnum">
            {page + 1} / {pages}
          </span>
          <button className="btn px-2 py-1" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
            下一页
          </button>
        </div>
      )}
    </Page>
  )
}
