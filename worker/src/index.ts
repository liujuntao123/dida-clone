import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
  ACCESS_KEY: string
}

type StateRow = {
  id: number
  payload: string
  updated_at: string
  revision: number
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'PUT', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Access-Key'],
    maxAge: 86400,
  }),
)

function extractKey(c: { req: { header: (name: string) => string | undefined } }): string | null {
  const auth = c.req.header('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  const xKey = c.req.header('X-Access-Key')
  if (xKey) return xKey.trim()
  return null
}

function requireAuth(c: {
  env: Bindings
  req: { header: (name: string) => string | undefined }
}): Response | null {
  const expected = c.env.ACCESS_KEY
  if (!expected) {
    return new Response(JSON.stringify({ error: 'ACCESS_KEY not configured on server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const key = extractKey(c)
  if (!key || key !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}

async function readState(db: D1Database): Promise<StateRow | null> {
  return db.prepare('SELECT id, payload, updated_at, revision FROM app_state WHERE id = 1').first<StateRow>()
}

function rowToResponse(row: StateRow | null) {
  if (!row) {
    return { revision: 0, updatedAt: null, state: null }
  }
  let state: unknown = null
  try {
    state = JSON.parse(row.payload)
  } catch {
    state = null
  }
  return { revision: row.revision, updatedAt: row.updated_at, state }
}

app.get('/api/health', (c) => c.json({ ok: true, service: 'dida-clone-sync' }))

app.get('/api/state', async (c) => {
  const denied = requireAuth(c)
  if (denied) return denied
  const row = await readState(c.env.DB)
  return c.json(rowToResponse(row))
})

app.put('/api/state', async (c) => {
  const denied = requireAuth(c)
  if (denied) return denied

  let body: { revision?: number; state?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (body.state === undefined) {
    return c.json({ error: 'Missing state' }, 400)
  }

  const current = await readState(c.env.DB)
  const clientRevision = body.revision

  if (
    current &&
    typeof clientRevision === 'number' &&
    clientRevision < current.revision
  ) {
    return c.json(
      {
        error: 'Conflict',
        message: 'Client revision is behind server',
        ...rowToResponse(current),
      },
      409,
    )
  }

  const nextRevision = (current?.revision ?? 0) + 1
  const updatedAt = new Date().toISOString()
  const payload = JSON.stringify(body.state)

  await c.env.DB.prepare(
    `INSERT INTO app_state (id, payload, updated_at, revision)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       payload = excluded.payload,
       updated_at = excluded.updated_at,
       revision = excluded.revision`,
  )
    .bind(payload, updatedAt, nextRevision)
    .run()

  return c.json({ revision: nextRevision, updatedAt, state: body.state })
})

app.post('/api/state/force', async (c) => {
  const denied = requireAuth(c)
  if (denied) return denied

  let body: { state?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (body.state === undefined) {
    return c.json({ error: 'Missing state' }, 400)
  }

  const current = await readState(c.env.DB)
  const nextRevision = (current?.revision ?? 0) + 1
  const updatedAt = new Date().toISOString()
  const payload = JSON.stringify(body.state)

  await c.env.DB.prepare(
    `INSERT INTO app_state (id, payload, updated_at, revision)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       payload = excluded.payload,
       updated_at = excluded.updated_at,
       revision = excluded.revision`,
  )
    .bind(payload, updatedAt, nextRevision)
    .run()

  return c.json({ revision: nextRevision, updatedAt, state: body.state })
})

app.all('*', (c) => c.json({ error: 'Not found' }, 404))

export default app
