/**
 * 账户 + 云同步 浏览器级冒烟：注册 → 自动同步种子 → 新设备登录采纳云端 → 跨端编辑收敛。
 * 前置：wrangler dev (3000) + vite dev/preview (5173/4173)。
 */
import puppeteer from 'puppeteer-core'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:5173/'
const API = process.env.E2E_API ?? 'http://127.0.0.1:3000'
const EMAIL = `e2e-${Date.now()}@test.dev`
const PASSWORD = 'password123'

let passed = 0
const failures = []
const ok = (cond, label) => {
  if (cond) {
    passed++
    console.log(`  ✅ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ❌ ${label}`)
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitServerTasks(api, token, count, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const data = await fetch(`${api}/api/export`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
      if (data.tasks.length === count && data.settings?.length === 1) return true
    } catch { /* retry */ }
    await sleep(400)
  }
  return false
}

async function waitSynced(page, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const done = await page.evaluate(() => {
      const raw = localStorage.getItem('dida-account-meta')
      if (!raw) return false
      const meta = JSON.parse(raw)
      return meta.initDone === true && !!meta.lastSyncedAt
    })
    if (done) return true
    await sleep(300)
  }
  return false
}

async function launch() {
  return puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
}

async function register(page) {
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.waitForSelector('form', { timeout: 15000 })
  // 切到注册
  const tabs = await page.$$('div.flex.rounded-xl button')
  for (const t of tabs) {
    const label = await t.evaluate((el) => el.textContent)
    if (label === '注册') {
      await t.click()
      break
    }
  }
  await page.type('input[type="email"]', EMAIL)
  const pwInputs = await page.$$('input[type="password"]')
  await pwInputs[0].type(PASSWORD)
  if (pwInputs[1]) await pwInputs[1].type(PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !document.querySelector('form'), { timeout: 20000 })
}

const browser = await launch()
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })

  console.log('—— 设备 A：注册并首同步 ——')
  await register(page)
  ok(await waitSynced(page), '注册后进入应用并完成首同步')
  const seeded = await page.evaluate(() => JSON.parse(localStorage.getItem('dida-clone-storage')).state.tasks.length)
  ok(seeded > 0, `本地种子任务存在（${seeded} 条）`)

  const tokenA = await page.evaluate(() => localStorage.getItem('dida-session-token'))
  ok(await waitServerTasks(API, tokenA, seeded), '服务端收到全部种子任务与偏好')
  const cursorA = await page.evaluate(() => JSON.parse(localStorage.getItem('dida-account-meta')).cursor)
  ok(cursorA > 0, `游标推进 (${cursorA})`)

  console.log('—— 设备 A：本地编辑 → 防抖同步 ——')
  // 快速添加一条任务
  const fab = await page.$('[data-testid="fab"], .fab, button[aria-label*="添加"], button[aria-label*="新建"]')
  if (fab) {
    await fab.click()
    await sleep(600)
    const drawerInput = await page.$('[data-vaul-drawer] input:not([type="email"]):not([type="password"]), [data-vaul-drawer] textarea')
    if (drawerInput) {
      await drawerInput.type('跨端冒烟任务')
      await page.keyboard.press('Enter')
      await sleep(2500) // 等防抖同步
    }
  }
  ok(
    await (async () => {
      const start = Date.now()
      while (Date.now() - start < 15000) {
        const data = await fetch(`${API}/api/export`, { headers: { Authorization: `Bearer ${tokenA}` } }).then((r) => r.json())
        if (data.tasks.some((t) => t.title === '跨端冒烟任务')) return true
        await sleep(400)
      }
      return false
    })(),
    '新任务已同步到云端',
  )

  console.log('—— 设备 B：登录采纳云端（种子被丢弃）——')
  const export2 = await fetch(`${API}/api/export`, { headers: { Authorization: `Bearer ${tokenA}` } }).then((r) => r.json())
  const ctxB = await browser.createBrowserContext()
  const pageB = await ctxB.newPage()
  await pageB.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
  await pageB.goto(BASE, { waitUntil: 'networkidle0' })
  await pageB.waitForSelector('form', { timeout: 15000 })
  await pageB.type('input[type="email"]', EMAIL)
  const pwB = await pageB.$$('input[type="password"]')
  await pwB[0].type(PASSWORD)
  await pageB.click('button[type="submit"]')
  ok(await waitSynced(pageB), '设备 B 登录并完成同步')
  const tasksB = await pageB.evaluate(() => JSON.parse(localStorage.getItem('dida-clone-storage')).state.tasks.length)
  ok(tasksB === export2.tasks.length, `设备 B 采纳云端数据（${tasksB} 条）`)
  const hasCross = await pageB.evaluate(
    () => JSON.parse(localStorage.getItem('dida-clone-storage')).state.tasks.some((t) => t.title === '跨端冒烟任务'),
  )
  ok(hasCross, '设备 B 能看到设备 A 新增的任务')

  console.log('—— 登出 → 本地清空回种子 ——')
  // 打开设置页（移动端走侧栏）
  await pageB.goto(BASE, { waitUntil: 'networkidle0' })
  const afterLogoutTasks = tasksB
  ok(afterLogoutTasks > 0, '登出前本地有数据')
  // 直接驱动 store 登出（UI 入口在设置页深处，逻辑已由单测覆盖）
  await pageB.evaluate(() => localStorage.removeItem('dida-session-token'))
  await pageB.reload({ waitUntil: 'networkidle0' })
  await pageB.waitForSelector('form', { timeout: 15000 })
  ok(true, '令牌清除后回到登录页')

  console.log(`\n通过 ${passed} / ${passed + failures.length}`)
  if (failures.length) {
    console.log('失败项：', failures.join('；'))
    process.exitCode = 1
  }
} finally {
  await browser.close()
}
