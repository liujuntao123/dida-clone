import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getAuth } from './auth'
import { ensureSchema } from './bootstrap'
import { adminApp } from './admin'
import { syncApp } from './sync'
import type { SyncHono } from './env'

const app: SyncHono = new Hono()

// ---------------------------------------------------------------------------
// CORS：bearer 令牌鉴权（无 cookie），但 Capacitor 壳与本地 dev 是跨源 fetch
// ---------------------------------------------------------------------------
const CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'ionic://localhost',
]

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) return null
      if (origin === c.env.APP_URL || CORS_ORIGINS.includes(origin)) return origin
      return null
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['set-auth-token'],
    maxAge: 86400,
  }),
)

// 每个 isolate 缓存一个 better-auth 实例，注入 Hono 变量供子路由使用
app.use('/api/*', async (c, next) => {
  await ensureSchema(c.env.DB)
  c.set('auth', getAuth(c.env))
  await next()
})
app.use('/admin/api/*', async (c, next) => {
  await ensureSchema(c.env.DB)
  c.set('auth', getAuth(c.env))
  await next()
})

// ---------------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------------

app.get('/api/health', (c) =>
  c.json({ ok: true, service: 'dida-clone-sync', protocol: 2, time: new Date().toISOString() }),
)

// better-auth：/api/auth/sign-up/email、/sign-in/email、/sign-out、/change-password、
// /list-sessions、/revoke-session、/get-session 以及 admin 插件的 /admin/* 端点
app.on(['POST', 'GET'], '/api/auth/*', (c) => getAuth(c.env).handler(c.req.raw))

app.route('/api', syncApp) // POST /api/sync · GET /api/export · DELETE /api/account
app.route('/admin/api', adminApp)

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404))
app.all('/admin/api/*', (c) => c.json({ error: 'Not found' }, 404))

app.notFound((c) => c.json({ error: 'Not found' }, 404))

export default app
