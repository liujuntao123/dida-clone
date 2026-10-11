import type { Hono } from 'hono'
import type { getAuth } from './auth'

export type Env = {
  DB: D1Database
  /** better-auth 签名密钥（wrangler secret put BETTER_AUTH_SECRET） */
  BETTER_AUTH_SECRET: string
  /** 服务自身地址，如 https://dida-clone-sync.xxx.workers.dev */
  APP_URL?: string
  /** 该邮箱注册的用户自动成为管理员 */
  ADMIN_EMAIL?: string
  /** 为 true 时关闭开放注册（管理员仍可经 admin API 建用户） */
  DISABLE_SIGNUPS?: string
}

/** 带 auth 变量注入的 Hono 应用类型 */
export type SyncHono = Hono<{
  Bindings: Env
  Variables: {
    auth: ReturnType<typeof getAuth>
    adminUser: { id: string; email: string }
  }
}>

/** 请求来源信息（日志用） */
export function requestMeta(req: Request): { ip: string; ua: string } {
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ''
  const ua = req.headers.get('user-agent') ?? ''
  return { ip, ua }
}

export async function writeAudit(
  db: D1Database,
  meta: { ip: string; ua: string },
  entry: { userId?: string | null; action: string; detail?: unknown },
): Promise<void> {
  try {
    await db
      .prepare(
        'INSERT INTO audit_log (user_id, action, detail, ip, ua, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        entry.userId ?? null,
        entry.action,
        entry.detail === undefined ? null : JSON.stringify(entry.detail),
        meta.ip,
        meta.ua,
        new Date().toISOString(),
      )
      .run()
  } catch {
    // 日志失败不影响主流程
  }
}
