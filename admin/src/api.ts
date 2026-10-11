/** 管理后台 API 客户端：与 App 同一套 better-auth + 自定义 admin 接口，Bearer 令牌鉴权 */

const TOKEN_KEY = 'dida-admin-token'
const BASE_KEY = 'dida-admin-base'

export function loadToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}
export function saveToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

/** API 基地址：留空 = 同源（线上同 Worker；本地 dev 走 vite 代理） */
export function getBase(): string {
  return localStorage.getItem(BASE_KEY) ?? ''
}
export function setBase(b: string) {
  const t = b.trim().replace(/\/+$/, '')
  if (t) localStorage.setItem(BASE_KEY, t)
  else localStorage.removeItem(BASE_KEY)
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(status: number, code?: string, message?: string) {
    super(message || code || `请求失败 (${status})`)
    this.status = status
    this.code = code
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const token = loadToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init?.body) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${getBase()}${path}`, { ...init, headers })
  const issued = res.headers.get('set-auth-token')
  if (issued) saveToken(issued)
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* 空响应 */
  }
  if (!res.ok) {
    const b = (body ?? {}) as { code?: string; message?: string }
    throw new ApiError(res.status, b.code, b.message)
  }
  return body as T
}

const post = (path: string, payload?: unknown) =>
  call<unknown>(path, { method: 'POST', body: payload === undefined ? undefined : JSON.stringify(payload) })

/* ---------- 类型 ---------- */

export type SessionUser = { id: string; email: string; name: string; role?: string | null }

export type AdminStats = {
  users: number
  activeSessions: number
  entities: Record<string, number>
  syncsToday: number
  errors7d: number
  lastSyncAt: string | null
  daily: { day: string; syncs: number; pushed: number; applied: number; pulled: number }[]
}

export type AdminUserRow = {
  id: string
  email: string
  name: string
  role: string | null
  banned: number | null
  createdAt: string
  emailVerified: number
  entities: number
  tasks: number
  sessions: number
  lastSyncAt: string | null
  totalSessions: number
}

export type SyncLogRow = {
  id: number
  user_id: string
  email: string | null
  device_id: string | null
  seq_from: number
  seq_to: number
  pushed: number
  applied: number
  skipped: number
  pulled: number
  duration_ms: number
  status: string
  error: string | null
  ip: string | null
  created_at: string
}

export type AuditLogRow = {
  id: number
  action: string
  detail: string | null
  ip: string | null
  ua: string | null
  created_at: string
  email: string | null
}

/* ---------- 端点 ---------- */

export const api = {
  async signIn(email: string, password: string): Promise<SessionUser> {
    const res = await post('/api/auth/sign-in/email', { email, password })
    const r = res as { user?: SessionUser }
    if (!r.user) throw new ApiError(500, undefined, '登录响应异常')
    return r.user
  },
  signOut(): Promise<unknown> {
    return post('/api/auth/sign-out').finally(() => clearToken())
  },
  me(): Promise<SessionUser | null> {
    return call<SessionUser | null>('/api/auth/get-session')
  },
  stats: () => call<AdminStats>('/admin/api/stats'),
  users: (q: { q?: string; limit?: number; offset?: number } = {}) => {
    const p = new URLSearchParams()
    if (q.q) p.set('q', q.q)
    if (q.limit) p.set('limit', String(q.limit))
    if (q.offset) p.set('offset', String(q.offset))
    return call<{ users: AdminUserRow[]; total: number }>(`/admin/api/users?${p}`)
  },
  banUser: (userId: string, banReason?: string) => post('/api/auth/admin/ban-user', { userId, banReason }),
  unbanUser: (userId: string) => post('/api/auth/admin/unban-user', { userId }),
  removeUser: (userId: string) => post('/api/auth/admin/remove-user', { userId }),
  syncLogs: (offset = 0, limit = 50) =>
    call<{ logs: SyncLogRow[] }>(`/admin/api/logs?type=sync&limit=${limit}&offset=${offset}`),
  auditLogs: (offset = 0, limit = 50) =>
    call<{ logs: AuditLogRow[] }>(`/admin/api/logs?type=audit&limit=${limit}&offset=${offset}`),
  gcTombstones: (days = 90) =>
    call<{ ok: boolean; removed: number }>(`/admin/api/maintenance/gc-tombstones?days=${days}`, { method: 'POST' }),
}
