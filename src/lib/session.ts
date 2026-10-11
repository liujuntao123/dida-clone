/**
 * 会话生命周期：启动恢复 / 过期处理 / 登出。
 *
 * 登出不等于清数据缓存——本地缓存保留到「下一次以任意账号登录」时按需处理，
 * 但会立即停同步引擎并回到登录页；敏感场景（换设备/公共电脑）由用户手动清空。
 */
import { authApi, clearToken, loadToken } from './auth'
import { clearMeta, loadMeta } from './account'
import { useSessionStore, type SessionUser } from '../store/useSessionStore'
import { startSyncEngine } from './cloudSync'
import { resetToSeed } from './resetState'

let stopSync: (() => void) | null = null
let bootPromise: Promise<void> | null = null

async function fetchSession(): Promise<SessionUser | null> {
  try {
    const data = await authApi.getSession()
    if (!data?.user) return null
    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role ?? null,
    }
  } catch {
    return null
  }
}

/** 应用启动时的会话恢复：有令牌则校验并进入应用，否则回登录页 */
export function bootSession(): Promise<void> {
  if (bootPromise) return bootPromise
  bootPromise = (async () => {
    const store = useSessionStore.getState()
    if (!loadToken()) {
      store.setPhase('anon')
      return
    }
    const user = await fetchSession()
    if (!user) {
      clearToken()
      clearMeta()
      useSessionStore.getState().setPhase('anon')
      return
    }
    enterApp(user)
  })()
  return bootPromise
}

function enterApp(user: SessionUser): void {
  // 预热账号元数据（账号切换时内部自动重置 cursor/initDone）
  loadMeta(user.id)
  useSessionStore.getState().setUser(user)
  if (stopSync) stopSync()
  stopSync = startSyncEngine(user.id, { onAuthExpired: handleAuthExpired })
}

/** 登录/注册成功后调用（令牌已在响应处理中落地） */
export async function completeLogin(): Promise<SessionUser | null> {
  const user = await fetchSession()
  if (!user) {
    useSessionStore.getState().setPhase('anon')
    return null
  }
  enterApp(user)
  useSessionStore.getState().setNotice(null)
  return user
}

/** 同步时 401：令牌失效 → 回登录页（保留本地缓存，重新登录同账号可无缝继续） */
export function handleAuthExpired(): void {
  clearToken()
  if (stopSync) {
    stopSync()
    stopSync = null
  }
  useSessionStore.getState().setNotice('登录已过期，请重新登录')
  useSessionStore.getState().setPhase('anon')
}

/** 主动登出：撤销服务端会话 + 清空本地数据回到种子态 */
export async function signOut(): Promise<void> {
  try {
    await authApi.signOut()
  } catch {
    // 服务端不可达也照常登出（本地清理）
  }
  clearToken()
  if (stopSync) {
    stopSync()
    stopSync = null
  }
  clearMeta()
  resetToSeed()
  useSessionStore.getState().setNotice(null)
  useSessionStore.getState().setUser(null)
  useSessionStore.getState().setPhase('anon')
}
