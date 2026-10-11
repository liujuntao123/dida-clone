
/**
 * 自举建表：首次用到数据库时幂等执行 CREATE TABLE IF NOT EXISTS。
 *
 * 目的有二：
 * 1. 部署机没有 `wrangler d1 execute` 权限时也能完成初始化（worker 自身的 D1 绑定可用）；
 * 2. self-host 零迁移体验——`wrangler deploy` 即完成建表。
 *
 * 与 schema.sql 的差异：不含 `DROP TABLE app_state`（v1 遗留表无害，留着即可）。
 * 每个 isolate 只执行一次；并发由 D1 串行化 + IF NOT EXISTS 保证安全。
 */

const STATEMENTS = [
  // better-auth 核心表
  `CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "emailVerified" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "role" TEXT,
    "banned" INTEGER,
    "banReason" TEXT,
    "banExpires" TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "impersonatedBy" TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TEXT,
    "refreshTokenExpiresAt" TEXT,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId")`,
  // 应用数据
  `CREATE TABLE IF NOT EXISTS "data_seq" (
    "user_id" TEXT PRIMARY KEY NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS "entity" (
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "rev_device" TEXT NOT NULL DEFAULT '',
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "seq" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("user_id", "type", "id")
  )`,
  `CREATE INDEX IF NOT EXISTS "entity_user_seq_idx" ON "entity" ("user_id", "seq")`,
  // 日志
  `CREATE TABLE IF NOT EXISTS "sync_log" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "seq_from" INTEGER NOT NULL DEFAULT 0,
    "seq_to" INTEGER NOT NULL DEFAULT 0,
    "pushed" INTEGER NOT NULL DEFAULT 0,
    "applied" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "pulled" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "error" TEXT,
    "ip" TEXT,
    "ua" TEXT,
    "created_at" TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "sync_log_user_idx" ON "sync_log" ("user_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "sync_log_created_idx" ON "sync_log" ("created_at")`,
  `CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "ip" TEXT,
    "ua" TEXT,
    "created_at" TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "audit_log_created_idx" ON "audit_log" ("created_at")`,
  `CREATE INDEX IF NOT EXISTS "audit_log_user_idx" ON "audit_log" ("user_id", "created_at")`,
]

let bootstrapPromise: Promise<boolean> | null = null
let bootstrapDone = false

function run(db: D1Database): Promise<boolean> {
  return (async () => {
    try {
      await db.batch(STATEMENTS.map((sql) => db.prepare(sql)))
      return true
    } catch (e) {
      console.error('[bootstrap] schema init failed:', e instanceof Error ? e.message : e)
      return false
    }
  })()
}

/** 每个 isolate 至多执行一次；失败后允许下次请求重试。 */
export function ensureSchema(db: D1Database): Promise<boolean> {
  if (!bootstrapPromise || (awaited(bootstrapPromise) === false)) {
    bootstrapPromise = run(db)
  }
  return bootstrapPromise
}

function awaited(p: Promise<boolean>): boolean | null {
  let settled: boolean | null = null
  p.then(
    (v) => (settled = v),
    () => (settled = false),
  )
  return settled
}

