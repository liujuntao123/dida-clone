/**
 * 一键 e2e：自动拉起本地后端（wrangler dev）+ 前端（vite preview），跑完断言后回收。
 *
 *   npm run e2e          # 等价于 node scripts/run-e2e.mjs
 *
 * 每次运行使用随机新鲜端口（避免端口劫持/半开连接问题），并先用 curl 预热认证链路。
 * wrangler dev 需要本地 D1 已应用 worker/schema.sql（首次：cd worker && npm run db:migrate:local）。
 * ⚠️ 在受限沙箱（如 AI agent 容器）里，后台进程树内 spawn 的 workerd 可能出现
 *    注册类请求永久挂起——本脚本用「curl 预热 + 多次重试」规避；仍失败时请改用
 *    前台终端手动启动两个服务后直接跑 `node scripts/e2e-check.mjs`。
 */
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

// 沙箱环境下被反复使用的端口可能出现监听劫持/半开连接，改为每次运行取随机新鲜端口
const API_PORT = process.env.E2E_API_PORT ?? String(21000 + (process.pid % 8000) * 2)
const WEB_PORT = process.env.E2E_WEB_PORT ?? String(21001 + (process.pid % 8000) * 2)
const BASE = `http://127.0.0.1:${WEB_PORT}/`
mkdirSync('screenshots/e2e', { recursive: true })

const children = []
function spawnChild(name, cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
  child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`))
  child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`))
  children.push(child)
  return child
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitHealthy(url, label, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        console.log(`[e2e] ${label} 就绪：${url}`)
        return
      }
    } catch {
      /* 未就绪 */
    }
    await sleep(800)
  }
  throw new Error(`${label} 未能在 ${timeoutMs}ms 内就绪：${url}`)
}

function shutdown() {
  for (const c of children) {
    try {
      c.kill('SIGTERM')
    } catch {
      /* ignore */
    }
  }
}
process.on('exit', shutdown)
process.on('SIGINT', () => process.exit(130))

try {
  spawnChild('worker', 'npx', ['wrangler', 'dev', '--port', API_PORT], { cwd: 'worker' })
  await waitHealthy(`http://127.0.0.1:${API_PORT}/api/health`, 'wrangler dev')

  // 认证链路预热：个别环境下 workerd 会出现瞬态写挂起，重启 wrangler 可恢复。
  // 这里做一次真实注册探测，失败则重启 wrangler 重试（最多 2 次）。
  // 用 curl（而非 node fetch）做首次预热：沙箱下 workerd 的第一个注册请求若来自
  // Node fetch 会永久挂起，curl 先行可完成懒初始化，之后一切客户端都正常。
  let warmed = false
  for (let attempt = 1; attempt <= 5 && !warmed; attempt++) {
    const email = `warmup-${Date.now()}-${attempt}@test.dev`
    try {
      const out = execFileSync(
        'curl',
        [
          '-s',
          '-m', '20',
          '-o', '/dev/null',
          '-w', '%{http_code}',
          '-X', 'POST',
          `http://127.0.0.1:${API_PORT}/api/auth/sign-up/email`,
          '-H', 'Content-Type: application/json',
          '-H', 'Origin: http://localhost:5173',
          '-d', JSON.stringify({ email, password: 'password123', name: 'warmup' }),
        ],
        { timeout: 25_000 },
      ).toString()
      if (out === '200') {
        warmed = true
        console.log(`[e2e] 认证链路就绪（第 ${attempt} 次探测）`)
      } else {
        console.error(`[e2e] 预热探测返回 ${out}`)
      }
    } catch (e) {
      console.error(`[e2e] 预热探测失败：${String(e.message).split('\n')[0]}`)
    }
    if (!warmed && attempt < 5) {
      console.error('[e2e] 重启 wrangler 后重试…')
      await sleep(3000)
      for (const c of children.splice(0)) c.kill('SIGTERM')
      await sleep(2000)
      spawnChild('worker', 'npx', ['wrangler', 'dev', '--port', API_PORT], { cwd: 'worker' })
      await waitHealthy(`http://127.0.0.1:${API_PORT}/api/health`, 'wrangler dev（重启）')
    }
  }
  if (!warmed) throw new Error('认证链路持续不可用，请检查本地 workerd 环境')

  spawnChild('web', 'npx', ['vite', 'preview', '--port', WEB_PORT, '--host', '127.0.0.1', '--strictPort'], {
    env: { ...process.env, DIDA_API_PROXY: `http://127.0.0.1:${API_PORT}` },
  })
  await waitHealthy(`${BASE}api/health`, 'vite preview（经代理连后端）')

  const test = spawn('node', ['scripts/e2e-check.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, E2E_BASE: BASE, E2E_API: `http://127.0.0.1:${API_PORT}` },
  })
  children.push(test)
  const code = await new Promise((resolve) => test.on('exit', resolve))
  process.exitCode = code ?? 1
} catch (e) {
  console.error('[e2e]', e.message)
  process.exitCode = 1
} finally {
  shutdown()
}
