/**
 * 视觉走查截图脚本：各页面 / 双主题 / 移动+桌面。
 * 用法：node scripts/ui-shots.mjs（需先 build + preview 4173）
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:4173/'
const DIR = 'screenshots/walkthrough'
mkdirSync(DIR, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch(args = []) {
  return puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', ...args],
  })
}

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
await page.goto(BASE, { waitUntil: 'networkidle0' })
await sleep(500)

const shot = (name) => page.screenshot({ path: `${DIR}/${name}.png` })
const clickText = (text) =>
  page.evaluate((t) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t)
    btn?.click()
  }, text)
const clickAria = (label) =>
  page.evaluate((l) => {
    document.querySelector(`button[aria-label="${l}"]`)?.click()
  }, label)
const openSidebarModule = async (menuLabel) => {
  await page.evaluate(() => {
    document.querySelector('nav[aria-label="主导航"] button[aria-label="更多"]')?.click()
  })
  await sleep(500)
  await clickText('添加')
  await sleep(350)
  await page.evaluate((t) => {
    const item = [...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent.trim() === t)
    item?.click()
  }, menuLabel)
  await sleep(550)
}
const backToMain = async () => {
  await clickAria('返回')
  await sleep(400)
  await clickAria('返回')
  await sleep(550)
}

// ---- 移动端 dark（默认）
await openSidebarModule('清单')
await shot('m-lists-dark')
await clickAria('添加清单')
await sleep(450)
await shot('m-list-form-dark')
await page.type('input[placeholder="名称"]', '旅行')
await sleep(250)
await shot('m-list-form-filled-dark')
await backToMain()

await openSidebarModule('标签')
await shot('m-tags-dark')
await clickAria('添加标签')
await sleep(450)
await shot('m-tag-form-dark')

// 设置页（侧栏头部齿轮）
await backToMain()
await page.evaluate(() => {
  document.querySelector('nav[aria-label="主导航"] button[aria-label="更多"]')?.click()
})
await sleep(500)
await clickAria('设置')
await sleep(550)
await shot('m-settings-top-dark')
await page.evaluate(() => {
  const els = document.querySelectorAll('.overflow-y-auto')
  els[els.length - 1]?.scrollTo(0, 99999)
})
await sleep(350)
await shot('m-settings-bottom-dark')
// 展开更多操作
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('更多操作'))
  btn?.click()
})
await sleep(350)
await shot('m-settings-advanced-dark')

// 快速添加抽屉
await page.evaluate(() => {
  document.querySelector('nav[aria-label="主导航"] button[aria-label="任务"]')?.click()
})
await sleep(500)
await page.evaluate(() => {
  const fab = document.querySelector('button[aria-label="添加任务"]')
  fab?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }))
  fab?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }))
})
await sleep(700)
await shot('m-quickadd-empty-dark')
await page.type('input[placeholder*="准备做什么"]', '明天 14:00 写周报')
await sleep(400)
await shot('m-quickadd-text-dark')
await page.keyboard.press('Escape')
await sleep(500)

// ---- 切浅色
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('dida-clone-storage'))
  raw.state.theme = 'light'
  localStorage.setItem('dida-clone-storage', JSON.stringify(raw))
})
await page.reload({ waitUntil: 'networkidle0' })
await sleep(600)

await openSidebarModule('清单')
await shot('m-lists-light')
await clickAria('添加清单')
await sleep(450)
await shot('m-list-form-light')
await backToMain()

await page.evaluate(() => {
  document.querySelector('nav[aria-label="主导航"] button[aria-label="更多"]')?.click()
})
await sleep(500)
await clickAria('设置')
await sleep(550)
await shot('m-settings-top-light')
await page.evaluate(() => {
  const els = document.querySelectorAll('.overflow-y-auto')
  els[els.length - 1]?.scrollTo(0, 99999)
})
await sleep(350)
await shot('m-settings-bottom-light')

// 主页面浅色
await page.evaluate(() => {
  document.querySelector('nav[aria-label="主导航"] button[aria-label="任务"]')?.click()
})
await sleep(500)
await shot('m-home-light')

// ---- 桌面端
await page.setViewport({ width: 1280, height: 800 })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(600)
await shot('d-home-light')
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === '设置')
  btn?.click()
})
await sleep(550)
await shot('d-settings-light')

await browser.close()
console.log('done')
