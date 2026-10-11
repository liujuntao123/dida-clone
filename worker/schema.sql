-- dida-clone 云端 v2：多用户账户体系 + 实体级 LWW 同步
-- 全新 schema，与 v1（app_state 整包 + Access Key）不兼容；v1 表直接清除。
-- better-auth 相关表（user/session/account/verification）列名与其 Kysely 适配器约定一致，勿随意改名。

DROP TABLE IF EXISTS app_state;

-- ---------------------------------------------------------------------------
-- better-auth 核心表
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "user" (
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
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "impersonatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "account" (
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
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

-- ---------------------------------------------------------------------------
-- 应用数据：按实体存储，(user_id, type, id) 唯一，seq 为每用户单调递增的变更批次号
-- ---------------------------------------------------------------------------

-- 每用户 seq 计数器（同步游标的分配源）
CREATE TABLE IF NOT EXISTS "data_seq" (
  "user_id" TEXT PRIMARY KEY NOT NULL,
  "seq" INTEGER NOT NULL DEFAULT 0
);

-- 实体表：task / list / tag / settings 四类；deleted=1 为墓碑（删除记录）
CREATE TABLE IF NOT EXISTS "entity" (
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "id" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "rev_device" TEXT NOT NULL DEFAULT '',
  "deleted" INTEGER NOT NULL DEFAULT 0,
  "seq" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("user_id", "type", "id")
);

CREATE INDEX IF NOT EXISTS "entity_user_seq_idx" ON "entity" ("user_id", "seq");

-- ---------------------------------------------------------------------------
-- 日志：同步流水（每次 /api/sync 一行）+ 审计（注册/登录/管理操作等）
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "sync_log" (
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
);

CREATE INDEX IF NOT EXISTS "sync_log_user_idx" ON "sync_log" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "sync_log_created_idx" ON "sync_log" ("created_at");

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" TEXT,
  "action" TEXT NOT NULL,
  "detail" TEXT,
  "ip" TEXT,
  "ua" TEXT,
  "created_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_log_created_idx" ON "audit_log" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_log_user_idx" ON "audit_log" ("user_id", "created_at");
