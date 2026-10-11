import { Hono } from 'hono'
import { requestMeta, writeAudit, type SyncHono } from './env'

/**
 * 后台管理 SaaS 专用 API（/admin/api/*）
 *
 * 认证：与 App 相同的 better-auth 会话（Bearer），额外要求 user.role = admin。
 * 用户封禁/解封/删除等操作由控制台直接调用 better-auth 内置 admin 端点
 * （/api/auth/admin/*），这里只提供统计数据、用户列表、日志与维护接口。
 */

export const adminApp: SyncHono = new Hono()

adminApp.use('*', async (c, next) => {
  const auth = c.get('auth')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: 'unauthorized' }, 401)
  if (session.user.role !== 'admin') return c.json({ error: 'forbidden' }, 403)
  c.set('adminUser', session.user as { id: string; email: string })
  await next()
})

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString()
}

function dayStartIso(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/** 总览：核心计数 + 近 7 天同步曲线 */
adminApp.get('/stats', async (c) => {
  const db = c.env.DB
  const since7 = isoDaysAgo(7)

  const [users, sessions, entities, syncsToday, daily, errors7d, lastSync] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS c FROM "user"').first<{ c: number }>(),
    db
      .prepare('SELECT COUNT(*) AS c FROM session WHERE "expiresAt" > ?')
      .bind(new Date().toISOString())
      .first<{ c: number }>(),
    db
      .prepare("SELECT type, COUNT(*) AS c FROM entity WHERE deleted = 0 GROUP BY type")
      .all<{ type: string; c: number }>(),
    db.prepare('SELECT COUNT(*) AS c FROM sync_log WHERE created_at >= ?').bind(dayStartIso()).first<{ c: number }>(),
    db
      .prepare(
        `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS syncs,
                COALESCE(SUM(pushed), 0) AS pushed, COALESCE(SUM(applied), 0) AS applied,
                COALESCE(SUM(pulled), 0) AS pulled
         FROM sync_log WHERE created_at >= ? GROUP BY day ORDER BY day`,
      )
      .bind(since7)
      .all<{ day: string; syncs: number; pushed: number; applied: number; pulled: number }>(),
    db
      .prepare("SELECT COUNT(*) AS c FROM sync_log WHERE created_at >= ? AND status != 'ok'")
      .bind(since7)
      .first<{ c: number }>(),
    db.prepare('SELECT MAX(created_at) AS t FROM sync_log').first<{ t: string | null }>(),
  ])

  const byType: Record<string, number> = {}
  for (const row of entities.results ?? []) byType[row.type] = row.c

  return c.json({
    users: users?.c ?? 0,
    activeSessions: sessions?.c ?? 0,
    entities: byType,
    syncsToday: syncsToday?.c ?? 0,
    errors7d: errors7d?.c ?? 0,
    lastSyncAt: lastSync?.t ?? null,
    daily: daily.results ?? [],
  })
})

/** 用户列表（带实体/会话/最近同步聚合） */
adminApp.get('/users', async (c) => {
  const db = c.env.DB
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? '50'), 1), 200)
  const offset = Math.max(Number(c.req.query('offset') ?? '0'), 0)
  const q = (c.req.query('q') ?? '').trim().toLowerCase()
  const now = new Date().toISOString()

  const rows = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.banned, u."createdAt" AS createdAt, u."emailVerified" AS emailVerified,
              (SELECT COUNT(*) FROM entity e WHERE e.user_id = u.id AND e.deleted = 0) AS entities,
              (SELECT COUNT(*) FROM entity e WHERE e.user_id = u.id AND e.type = 'task' AND e.deleted = 0) AS tasks,
              (SELECT COUNT(*) FROM session s WHERE s."userId" = u.id AND s."expiresAt" > ?1) AS sessions,
              (SELECT MAX(created_at) FROM sync_log s WHERE s.user_id = u.id) AS lastSyncAt,
              (SELECT COUNT(*) FROM session s WHERE s."userId" = u.id) AS totalSessions
       FROM "user" u
       WHERE ?2 = '' OR LOWER(u.email) LIKE '%' || ?2 || '%' OR LOWER(u.name) LIKE '%' || ?2 || '%'
       ORDER BY u."createdAt" DESC
       LIMIT ?3 OFFSET ?4`,
    )
    .bind(now, q, limit, offset)
    .all()
  const total = await db
    .prepare(`SELECT COUNT(*) AS c FROM "user" u WHERE ?1 = '' OR LOWER(u.email) LIKE '%' || ?1 || '%'`)
    .bind(q)
    .first<{ c: number }>()

  return c.json({ users: rows.results ?? [], total: total?.c ?? 0, limit, offset })
})

/** 单用户详情：会话列表 + 最近同步 + 最近审计 */
adminApp.get('/users/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const user = await db
    .prepare(
      'SELECT id, email, name, role, banned, banReason, "createdAt" AS createdAt, "updatedAt" AS updatedAt FROM "user" WHERE id = ?',
    )
    .bind(id)
    .first()
  if (!user) return c.json({ error: 'not found' }, 404)

  const [sessions, entityStats, syncs, audits] = await Promise.all([
    db
      .prepare(
        `SELECT id, "createdAt" AS createdAt, "expiresAt" AS expiresAt, ipAddress, userAgent
         FROM session WHERE "userId" = ? ORDER BY "createdAt" DESC LIMIT 20`,
      )
      .bind(id)
      .all(),
    db
      .prepare("SELECT type, COUNT(*) AS c FROM entity WHERE user_id = ? AND deleted = 0 GROUP BY type")
      .bind(id)
      .all<{ type: string; c: number }>(),
    db
      .prepare(
        `SELECT device_id, seq_from, seq_to, pushed, applied, skipped, pulled, duration_ms, status, error, created_at
         FROM sync_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      )
      .bind(id)
      .all(),
    db
      .prepare('SELECT action, detail, ip, ua, created_at FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
      .bind(id)
      .all(),
  ])

  const byType: Record<string, number> = {}
  for (const row of entityStats.results ?? []) byType[row.type] = row.c

  return c.json({ user, sessions: sessions.results ?? [], entities: byType, syncs: syncs.results ?? [], audits: audits.results ?? [] })
})

/** 日志（sync | audit） */
adminApp.get('/logs', async (c) => {
  const db = c.env.DB
  const type = c.req.query('type') === 'audit' ? 'audit' : 'sync'
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? '50'), 1), 200)
  const offset = Math.max(Number(c.req.query('offset') ?? '0'), 0)
  const userId = (c.req.query('userId') ?? '').trim()

  if (type === 'audit') {
    const rows = await db
      .prepare(
        `SELECT a.id, a.action, a.detail, a.ip, a.ua, a.created_at, u.email
         FROM audit_log a LEFT JOIN "user" u ON u.id = a.user_id
         WHERE (?1 = '' OR a.user_id = ?1)
         ORDER BY a.created_at DESC LIMIT ?2 OFFSET ?3`,
      )
      .bind(userId, limit, offset)
      .all()
    return c.json({ type, logs: rows.results ?? [], limit, offset })
  }

  const rows = await db
    .prepare(
      `SELECT l.*, u.email
       FROM sync_log l LEFT JOIN "user" u ON u.id = l.user_id
       WHERE (?1 = '' OR l.user_id = ?1)
       ORDER BY l.created_at DESC LIMIT ?2 OFFSET ?3`,
    )
    .bind(userId, limit, offset)
    .all()
  return c.json({ type, logs: rows.results ?? [], limit, offset })
})

/** 维护：清理超期墓碑（须确保所有设备在保留期内活跃过，详见 docs/sync-design.md） */
adminApp.post('/maintenance/gc-tombstones', async (c) => {
  const days = Math.min(Math.max(Number((c.req.query('days') ?? '90')), 30), 365)
  const cutoff = isoDaysAgo(days)
  const res = await c.env.DB.prepare('DELETE FROM entity WHERE deleted = 1 AND updated_at < ?').bind(cutoff).run()
  const meta = requestMeta(c.req.raw)
  const admin = c.get('adminUser')
  await writeAudit(c.env.DB, meta, {
    userId: admin?.id ?? null,
    action: 'admin.gc_tombstones',
    detail: { days, removed: res.meta?.changes ?? 0, cutoff },
  })
  return c.json({ ok: true, removed: res.meta?.changes ?? 0, cutoff })
})
