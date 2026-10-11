/**
 * 账户体系客户端（better-auth 协议的极简封装，Bearer 令牌模式）。
 *
 * - 令牌由服务端登录/注册响应的 set-auth-token 头下发，存 localStorage；
 * - 所有请求经 authFetch 自动附加 Authorization 头；
 * - /api/sync 等业务接口同样使用该令牌（见 cloudSync.ts）。
 */
import { getAuthBase } from './config'

const TOKEN_KEY = 'dida-session-token'

export function loadToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function hasToken(): boolean {
  return !!loadToken()
}

export type AuthError = { status: number; code?: string; message?: string }

export class AuthApiError extends Error implements AuthError {
  status: number
  code?: string
  constructor(err: AuthError) {
    super(err.message ?? err.code ?? `请求失败 (${err.status})`)
    this.name = 'AuthApiError'
    this.status = err.status
    this.code = err.code
  }
}

/** 给发往认证端点的请求附加 bearer 令牌 */
async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  const token = loadToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(`${getAuthBase()}${path}`, { ...init, headers })
  // bearer 插件在登录/注册成功时经 set-auth-token 下发令牌
  const issued = res.headers.get('set-auth-token')
  if (issued) saveToken(issued)
  return res
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, init)
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // 空响应体
  }
  if (!res.ok) {
    const b = (body ?? {}) as { code?: string; message?: string }
    throw new AuthApiError({ status: res.status, code: b.code, message: b.message })
  }
  return body as T
}

const post = (path: string, payload?: unknown) =>
  call<unknown>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })

export type SessionUser = { id: string; email: string; name: string; role?: string | null }

type SessionResponse = { user?: SessionUser; session?: { token: string } }

/** better-auth 认证端点的最小封装 */
export const authApi = {
  signUpEmail(input: { email: string; password: string; name: string }): Promise<SessionResponse> {
    return post('/sign-up/email', input) as Promise<SessionResponse>
  },
  signInEmail(input: { email: string; password: string }): Promise<SessionResponse> {
    return post('/sign-in/email', input) as Promise<SessionResponse>
  },
  signOut(): Promise<unknown> {
    return post('/sign-out')
  },
  getSession(): Promise<SessionResponse | null> {
    return call<SessionResponse | null>('/get-session')
  },
  changePassword(input: {
    currentPassword: string
    newPassword: string
    revokeOtherSessions?: boolean
  }): Promise<unknown> {
    return post('/change-password', input)
  },
  listSessions(): Promise<
    { token: string; createdAt: string; expiresAt: string; ipAddress?: string | null; userAgent?: string | null }[]
  > {
    return call('/list-sessions')
  },
  revokeSession(input: { token: string }): Promise<unknown> {
    return post('/revoke-session', input)
  },
}

/** better-auth 错误 → 中文提示 */
export function authErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return '未知错误'
  const e = err as AuthError & Error
  switch (e.code ?? e.message) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return '邮箱或密码不正确'
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return '该邮箱已注册，请直接登录'
    case 'PASSWORD_TOO_SHORT':
      return '密码至少 8 位'
    case 'INVALID_EMAIL':
      return '邮箱格式不正确'
    case 'FAILED_TO_CREATE_USER':
    case 'FAILED_TO_CREATE_SESSION':
      return '服务暂时不可用，请稍后再试'
    default: {
      if (e.status === 401 || e.status === 403) return '邮箱或密码不正确'
      if (e.status === 404) return '服务地址不正确或服务不可用'
      if (e.status === 429) return '尝试过于频繁，请稍后再试'
      if (e.status !== undefined && e.status >= 500) return '服务暂时不可用，请稍后再试'
      if (!navigator.onLine) return '当前离线，请检查网络'
      return e.message || '操作失败，请检查网络'
    }
  }
}
