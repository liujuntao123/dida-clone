import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { admin, bearer } from 'better-auth/plugins'
import { requestMeta, writeAudit, type Env } from './env'
import { hashPassword, verifyPassword } from './password'

/**
 * 允许的前端来源：
 * - 线上 Worker 自身（admin 控制台同源）
 * - 本地 vite dev / preview（经代理访问 wrangler dev）
 * - Capacitor 安卓壳（androidScheme: https → https://localhost）
 */
const EXTRA_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'ionic://localhost',
]

function statusOf(returned: unknown): number {
  if (returned instanceof Response) return returned.status
  if (returned && typeof returned === 'object') {
    const r = returned as { status?: unknown; statusCode?: unknown }
    if (typeof r.statusCode === 'number') return r.statusCode
    if (typeof r.status === 'number') return r.status
  }
  return 200
}

function userIdOf(returned: unknown): string | null {
  if (!returned || typeof returned !== 'object') return null
  const r = returned as { user?: { id?: unknown }; id?: unknown }
  if (r.user && typeof r.user.id === 'string') return r.user.id
  if (typeof r.id === 'string' && r.id.length > 8) return r.id
  return null
}

function buildAuth(env: Env) {
  return betterAuth({
    database: env.DB, // 原生 D1 支持（内部走 batch，无交互事务）
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    trustedOrigins: [...(env.APP_URL ? [env.APP_URL] : []), ...EXTRA_ORIGINS],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: false,
      autoSignIn: true,
      // Workers 免费版 10ms CPU 限额装不下默认 scrypt，改用 WebCrypto PBKDF2
      password: { hash: hashPassword, verify: verifyPassword },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 天
      updateAge: 60 * 60 * 24, // 每天滑动续期
      freshTime: 60 * 10,
    },
    advanced: {
      cookiePrefix: 'dida',
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      specialRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 10 },
      },
    },
    plugins: [bearer(), admin()],
    databaseHooks: {
      user: {
        create: {
          // ADMIN_EMAIL 注册即管理员；其余为普通用户（在 admin 插件的默认 role 之后执行）
          before: async (user) => ({
            data: {
              ...user,
              role:
                env.ADMIN_EMAIL &&
                String(user.email).toLowerCase() === env.ADMIN_EMAIL.toLowerCase()
                  ? 'admin'
                  : 'user',
            },
          }),
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email') {
          if (env.DISABLE_SIGNUPS === 'true') {
            throw new APIError('FORBIDDEN', { message: '注册已关闭，请联系管理员' })
          }
          // 注册只需邮箱 + 密码：name 缺省由邮箱本地部分派生
          const body = ctx.body as { name?: string; email?: string } | undefined
          if (body && !body.name) {
            body.name = String(body.email ?? '').split('@')[0] || '用户'
          }
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        try {
          const returned: unknown = ctx.context.returned
          const status = statusOf(returned)
          const ok = status < 400
          const body = (ctx.body ?? {}) as { email?: string }
          const meta = requestMeta(ctx.request as unknown as Request)

          let action: string | null = null
          let userId = userIdOf(returned)
          let detail: Record<string, unknown> = { status }
          if (body.email) detail.email = body.email

          switch (ctx.path) {
            case '/sign-up/email':
              action = 'auth.register'
              break
            case '/sign-in/email':
              action = ok ? 'auth.login' : 'auth.login_failed'
              break
            case '/sign-out':
              action = 'auth.logout'
              break
            case '/change-password':
              action = ok ? 'auth.password_changed' : null
              break
            default:
              if (ctx.path.startsWith('/admin/')) {
                action = `admin.${ctx.path.replace('/admin/', '').replaceAll('/', '_')}`
                detail.target = ctx.params
              }
          }
          if (action) {
            await writeAudit(env.DB, meta, { userId, action, detail })
          }
        } catch {
          // 审计失败不影响认证主流程
        }
      }),
    },
  })
}

// better-auth 实例按 isolate 缓存（同一 isolate 内 env 绑定稳定）
let cached: { auth: ReturnType<typeof buildAuth>; key: string } | null = null

export function getAuth(env: Env) {
  const key = `${env.APP_URL ?? ''}|${env.ADMIN_EMAIL ?? ''}|${env.DISABLE_SIGNUPS ?? ''}`
  if (!cached || cached.key !== key) {
    cached = { auth: buildAuth(env), key }
  }
  return cached.auth
}
