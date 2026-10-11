import { Hono } from 'hono'
import { requestMeta, writeAudit, type SyncHono } from './env'

/**
 * 同步协议 v2（实体级 LWW + 单调游标）
 *
 * 请求：POST /api/sync
 *   { deviceId, cursor, entities: { tasks?, lists?, tags?, settings? } }
 *   - entities 里是全量本地实体（状态基同步，天然幂等，丢包/中断重发无损）
 *   - 每个实体携带 updatedAt（客户端逻辑时间）+ deleted（墓碑标记）
 *
 * 服务端：
 *   - LWW：以 (updatedAt, deviceId) 字典序为唯一裁决键，键大者胜
 *   - updatedAt 超前服务器时钟 2 分钟以上会被钳制（防时钟漂移设备永久霸权）
 *   - 接受的写入分配每用户单调递增的 seq（批次内连续区间）
 *   - 返回 seq > cursor 的全部变更（含被拒绝时服务端的新版本）+ 新 cursor
 *
 * 客户端以同样的键比较应用服务端版本 → 双端对任意交错请求序列收敛到同一状态。
 */

export const ENTITY_TYPES = ['task', 'list', 'tag', 'settings'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

const MAX_ENTITIES = 5000
const MAX_BODY_BYTES = 8 * 1024 * 1024
const BATCH_CHUNK = 80
const CLOCK_SKEW_MS = 2 * 60 * 1000
const DELTA_LIMIT = 5000
const SYNC_LOG_RETENTION_DAYS = 90

type IncomingEntity = {
  type: EntityType
  id: string
  updatedAt: string
  revDevice: string
  deleted: boolean
  payload: string
}

type ExistingMeta = {
  type: string
  id: string
  updated_at: string
  rev_device: string
  deleted: number
}

type DeltaRow = {
  type: string
  id: string
  payload: string
  updated_at: string
  rev_device: string
  deleted: number
  seq: number
}

function lwwGreater(aUpdatedAt: string, aDevice: string, bUpdatedAt: string, bDevice: string): boolean {
  if (aUpdatedAt !== bUpdatedAt) return aUpdatedAt > bUpdatedAt
  return aDevice > bDevice
}
function normDeviceId(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.slice(0, 128)
}

function normUpdatedAt(v: unknown, clampIso: string): string | null {
  if (typeof v !== 'string' || v.length < 4 || v.length > 40) return null
  const t = Date.parse(v)
  if (Number.isNaN(t)) return null
  const iso = new Date(t).toISOString()
  return iso > clampIso ? clampIso : iso
}

/** 请求字段（复数）→ 实体类型（单数） */
const ENTITY_FIELDS: [field: string, type: EntityType][] = [
  ['tasks', 'task'],
  ['lists', 'list'],
  ['tags', 'tag'],
  ['settings', 'settings'],
]

/** 解析并校验请求里的实体集合，非法项直接丢弃计数 */
function parseIncoming(
  raw: unknown,
  clampIso: string,
): { entities: IncomingEntity[]; invalid: number } {
  const entities: IncomingEntity[] = []
  let invalid = 0
  const src = (raw ?? {}) as Record<string, unknown>
  for (const [field, type] of ENTITY_FIELDS) {
    const arr = src[field]
    if (!Array.isArray(arr)) continue
    for (const item of arr) {
      if (entities.length >= MAX_ENTITIES) break
      if (!item || typeof item !== 'object') {
        invalid++
        continue
      }
      const e = item as Record<string, unknown>
      const id = typeof e.id === 'string' ? e.id.slice(0, 128) : ''
      const updatedAt = normUpdatedAt(e.updatedAt, clampIso)
      if (!id || !updatedAt) {
        invalid++
        continue
      }
      const deleted = e.deleted === true
      entities.push({
        type,
        id,
        updatedAt,
        revDevice: normDeviceId(e.deviceId),
        deleted,
        payload: JSON.stringify(e),
      })
    }
  }
  return { entities, invalid }
}

function rowToChange(row: DeltaRow) {
  let payload: unknown = null
  try {
    payload = JSON.parse(row.payload)
  } catch {
    payload = null
  }
  return {
    type: row.type,
    id: row.id,
    updatedAt: row.updated_at,
    deviceId: row.rev_device,
    deleted: row.deleted === 1,
    data: payload,
  }
}

export const syncApp: SyncHono = new Hono()

syncApp.use('/sync', async (c, next) => {
  const len = Number(c.req.header('content-length') ?? '0')
  if (len > MAX_BODY_BYTES) {
    return c.json({ error: 'Payload too large' }, 413)
  }
  await next()
})

syncApp.post('/sync', async (c) => {
  const auth = c.get('auth')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const userId = session.user.id
  const db = c.env.DB

  let body: {
    deviceId?: unknown
    cursor?: unknown
    entities?: unknown
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const deviceId = normDeviceId(body.deviceId)
  const cursor =
    typeof body.cursor === 'number' && Number.isFinite(body.cursor) && body.cursor >= 0
      ? Math.floor(body.cursor)
      : 0

  const startedAt = Date.now()
  const clampIso = new Date(Date.now() + CLOCK_SKEW_MS).toISOString()
  const { entities, invalid } = parseIncoming(body.entities, clampIso)

  // 同一实体在一次请求里出现多次时，保留 updatedAt 最大的一条
  const deduped = new Map<string, IncomingEntity>()
  for (const e of entities) {
    const key = `${e.type}:${e.id}`
    const prev = deduped.get(key)
    if (!prev || lwwGreater(e.updatedAt, e.revDevice, prev.updatedAt, prev.revDevice)) {
      deduped.set(key, e)
    }
  }
  const incoming = [...deduped.values()]

  // 现有实体元数据（个人规模全量拉取元数据列即可）
  const existingRows = await db
    .prepare('SELECT type, id, updated_at, rev_device, deleted FROM entity WHERE user_id = ?')
    .bind(userId)
    .all<ExistingMeta>()
  const existing = new Map<string, ExistingMeta>()
  for (const row of existingRows.results ?? []) {
    existing.set(`${row.type}:${row.id}`, row)
  }

  // LWW 裁决：(updatedAt, deviceId) 字典序大者胜；精确并列时墓碑优先（确定性收敛）
  const accepted: IncomingEntity[] = []
  let skipped = 0
  for (const e of incoming) {
    const cur = existing.get(`${e.type}:${e.id}`)
    if (!cur) {
      accepted.push(e)
      continue
    }
    if (lwwGreater(e.updatedAt, e.revDevice, cur.updated_at, cur.rev_device)) {
      accepted.push(e)
      continue
    }
    const curDeleted = cur.deleted === 1
    const exactTie = e.updatedAt === cur.updated_at && e.revDevice === cur.rev_device
    if (exactTie && e.deleted !== curDeleted) {
      // 同一时刻同一设备的「删除 vs 存活」冲突：删除赢
      if (e.deleted) accepted.push(e)
      continue
    }
    skipped++
  }

  // 分配单调 seq：批次内连续区间 [maxSeq - k + 1, maxSeq]
  let allocatedMax = cursor
  if (accepted.length > 0) {
    await db
      .prepare('INSERT INTO data_seq (user_id, seq) VALUES (?, 0) ON CONFLICT (user_id) DO NOTHING')
      .bind(userId)
      .run()
    const seqRes = await db
      .prepare('UPDATE data_seq SET seq = seq + ? WHERE user_id = ? RETURNING seq')
      .bind(accepted.length, userId)
      .all<{ seq: number }>()
    allocatedMax = Number(seqRes.results?.[0]?.seq ?? 0)
    const base = allocatedMax - accepted.length

    const stmt = db.prepare(
      `INSERT INTO entity (user_id, type, id, payload, updated_at, rev_device, deleted, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, type, id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at,
         rev_device = excluded.rev_device,
         deleted = excluded.deleted,
         seq = excluded.seq`,
    )
    for (let i = 0; i < accepted.length; i += BATCH_CHUNK) {
      const chunk = accepted.slice(i, i + BATCH_CHUNK)
      await db.batch(
        chunk.map((e, j) => {
          const seq = base + i + j + 1
          return stmt.bind(userId, e.type, e.id, e.payload, e.updatedAt, e.revDevice, e.deleted ? 1 : 0, seq)
        }),
      )
    }
  }

  // 变更流：seq > cursor 的所有行（含本轮接受与并发设备写入）
  const delta = await db
    .prepare(
      `SELECT type, id, payload, updated_at, rev_device, deleted, seq
       FROM entity WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ${DELTA_LIMIT}`,
    )
    .bind(userId, cursor)
    .all<DeltaRow>()

  const changes = { task: [], list: [], tag: [], settings: [] } as Record<string, unknown[]>
  let deltaMax = cursor
  let pulled = 0
  for (const row of delta.results ?? []) {
    if (row.seq > deltaMax) deltaMax = row.seq
    changes[row.type]?.push(rowToChange(row))
    pulled++
  }

  // 游标不得超前服务端计数器（服务器库被重置时自愈）
  const seqRow = await db
    .prepare('SELECT seq FROM data_seq WHERE user_id = ?')
    .bind(userId)
    .first<{ seq: number }>()
  const serverSeq = Number(seqRow?.seq ?? 0)
  let nextCursor = Math.max(cursor, allocatedMax, deltaMax)
  if (nextCursor > serverSeq) nextCursor = serverSeq

  const durationMs = Date.now() - startedAt
  const meta = requestMeta(c.req.raw)

  // 同步流水（每 20 次顺带清理 90 天前的旧日志）
  try {
    const logStmt = db.prepare(
      `INSERT INTO sync_log (user_id, device_id, seq_from, seq_to, pushed, applied, skipped, pulled, duration_ms, status, error, ip, ua, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', NULL, ?, ?, ?)`,
    )
    const prune =
      incoming.length > 0 && Math.random() < 0.05
        ? db.prepare('DELETE FROM sync_log WHERE created_at < ?').bind(
            new Date(Date.now() - SYNC_LOG_RETENTION_DAYS * 86400_000).toISOString(),
          )
        : null
    await db.batch([
      logStmt.bind(
        userId,
        deviceId,
        cursor,
        nextCursor,
        incoming.length,
        accepted.length,
        skipped,
        pulled,
        durationMs,
        meta.ip,
        meta.ua,
        new Date().toISOString(),
      ),
      ...(prune ? [prune] : []),
    ])
  } catch {
    // 日志失败不影响同步
  }

  return c.json({
    cursor: nextCursor,
    serverTime: new Date().toISOString(),
    changes: {
      tasks: changes.task,
      lists: changes.list,
      tags: changes.tag,
      settings: changes.settings,
    },
    result: { applied: accepted.length, skippedOlder: skipped, invalid },
  })
})

/** 全量导出（设置页「导出数据」走本地即可，此接口给脚本/备份用） */
syncApp.get('/export', async (c) => {
  const auth = c.get('auth')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: 'unauthorized' }, 401)
  const rows = await c.env.DB.prepare(
    `SELECT type, id, payload, updated_at, deleted FROM entity
     WHERE user_id = ? AND deleted = 0 ORDER BY type, id`,
  )
    .bind(session.user.id)
    .all<{ type: string; id: string; payload: string; updated_at: string }>()
  const out: Record<string, unknown[]> = { task: [], list: [], tag: [], settings: [] }
  for (const row of rows.results ?? []) {
    try {
      out[row.type]?.push(JSON.parse(row.payload))
    } catch {
      // 跳过损坏行
    }
  }
  return c.json({
    exportedAt: new Date().toISOString(),
    account: session.user.email,
    tasks: out.task,
    lists: out.list,
    tags: out.tag,
    settings: out.settings,
  })
})

/** 注销账号：清除全部数据 + 认证记录；审计日志保留但抹去 user_id */
syncApp.delete('/account', async (c) => {
  const auth = c.get('auth')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: 'unauthorized' }, 401)
  const userId = session.user.id
  const db = c.env.DB
  await db.batch([
    db.prepare('DELETE FROM entity WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM data_seq WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM sync_log WHERE user_id = ?').bind(userId),
    db.prepare('UPDATE audit_log SET user_id = NULL, detail = detail WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM session WHERE userId = ?').bind(userId),
    db.prepare('DELETE FROM account WHERE userId = ?').bind(userId),
    db.prepare('DELETE FROM "user" WHERE id = ?').bind(userId),
  ])
  const meta = requestMeta(c.req.raw)
  await writeAudit(db, meta, {
    userId: null,
    action: 'account.deleted',
    detail: { email: session.user.email },
  })
  return c.json({ ok: true })
})
