/**
 * 云端服务地址解析。
 *
 * 优先级：用户覆盖（localStorage）> Capacitor 壳内置默认 > Web 同源（dev 由 vite 代理转发）。
 * 自托管者在登录页「高级选项」或设置页填自己的 Worker 地址即可。
 */
import { Capacitor } from '@capacitor/core'

const OVERRIDE_KEY = 'dida-api-base-override'

/** wrangler deploy 的默认线上地址（自托管构建时可用 VITE_API_BASE_URL 覆盖） */
export const DEFAULT_API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://dida-clone-sync.royal-silence-b1e6.workers.dev'

export function getApiBaseOverride(): string {
  try {
    return (localStorage.getItem(OVERRIDE_KEY) ?? '').replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export function setApiBaseOverride(base: string): void {
  const trimmed = base.trim().replace(/\/+$/, '')
  if (trimmed) localStorage.setItem(OVERRIDE_KEY, trimmed)
  else localStorage.removeItem(OVERRIDE_KEY)
}

/** 空字符串 = 同源相对路径（Web dev/prod 同源部署），原生壳用绝对地址 */
export function getApiBase(): string {
  const override = getApiBaseOverride()
  if (override) return override
  if (Capacitor.isNativePlatform()) return DEFAULT_API_BASE
  return ''
}

export function getAuthBase(): string {
  const base = getApiBase()
  return `${base}/api/auth`
}

export function isUsingOverride(): boolean {
  return !!getApiBaseOverride()
}
