/**
 * dida-clone E2E 验证脚本（puppeteer-core + 系统 Chrome）
 *
 * 覆盖：
 *  - 移动端：非热点区域右滑开菜单 / 左滑任务呼出操作按钮（不误删）/ FAB 快速添加
 *  - 标签：侧栏建标签 / 详情面板建标签并自动挂载 / 标签视图跳转
 *  - 子任务：回车连续录入（空输入也允许添加下一条）
 *  - 桌面：hover 操作按状态变化 / 垃圾桶恢复 / 永久删除确认 / 明天智能清单
 *  - 过场动画：抽屉开合 transition / 视图切换动画类
 *
 * 用法：先 `npm run build`，再 `npm run preview -- --port 4173`，然后 `node scripts/e2e-check.mjs`
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:4173/'
const SHOT_DIR = 'screenshots/e2e'
mkdirSync(SHOT_DIR, { recursive: true })

let passed = 0
const failures = []

function ok(cond, label) {
  if (cond) {
    passed++
    console.log(`  ✅ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ❌ ${label}`)
  }
}

async function shot(page, name) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function swipe(page, x1, y1, x2, y2, steps = 14) {
  await page.touchscreen.touchStart(x1, y1)
  for (let i = 1; i <= steps; i++) {
    await page.touchscreen.touchMove(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps)
  }
  await page.touchscreen.touchEnd()
}

async function tasksFromStorage(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('dida-clone-storage')
    return raw ? JSON.parse(raw).state.tasks : []
  })
}

async function launch(extraArgs = []) {
  return puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    // overscroll-history-navigation=0：禁用 Chrome 的横向滑动前进/后退导航，
    // 否则测试里的滑动手势会触发页面历史导航。
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--overscroll-history-navigation=0',
      ...extraArgs,
    ],
  })
}

/** 收集页面错误 */
function watchErrors(page, bucket) {
  page.on('pageerror', (e) => bucket.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') bucket.push(`console.error: ${m.text()}`)
  })
}

// ---------------------------------------------------------------- mobile
async function mobileSuite(browser) {
  console.log('\n——— 移动端（390×844 touch）———')
  const page = await browser.newPage()
  const errors = []
  watchErrors(page, errors)
  await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.waitForSelector('h1')
  await sleep(400)

  const drawerPanel = () =>
    page.evaluate(() => {
      const overlay = document.querySelector('[aria-label="关闭侧栏"]')?.parentElement
      if (!overlay) return null
      const panel = overlay.lastElementChild
      const rect = panel.getBoundingClientRect()
      return { x: rect.x, transition: getComputedStyle(panel).transitionDuration, inert: panel.inert }
    })

  // 1. 初始加载
  const h1 = await page.$eval('h1', (el) => el.textContent)
  ok(h1 === '今天', `默认进入「今天」视图 (h1=${h1})`)
  await shot(page, 'm01-initial')

  // 2. 非热点区域右滑 → 打开菜单（页面标题 h1 属于非热点；先动态取它的位置）
  const h1Point = await page.evaluate(() => {
    const r = document.querySelector('h1').getBoundingClientRect()
    return { x: Math.min(r.x + 60, r.right - 10), y: r.y + r.height / 2 }
  })
  await swipe(page, h1Point.x, h1Point.y, h1Point.x + 230, h1Point.y + 4)
  await sleep(450)
  let d = await drawerPanel()
  ok(d && d.x === 0, `右滑后抽屉打开 (panel.x=${d?.x})`)
  ok(d && d.transition !== '0s', `抽屉有过场动画 (transition-duration=${d?.transition})`)
  await shot(page, 'm02-drawer-open')

  // 3. 抽屉上左滑 → 收起
  await swipe(page, 250, 400, 60, 396)
  await sleep(450)
  d = await drawerPanel()
  ok(d && d.x < -100, `左滑后抽屉收起 (panel.x=${d?.x})`)
  ok(d && d.inert, '收起后抽屉内容不可交互 (inert)')
  await shot(page, 'm03-drawer-closed')

  // 4. 任务行左滑 → 呼出操作按钮，且不直接删除
  const beforeTasks = await tasksFromStorage(page)
  const beforeCount = beforeTasks.length
  const row = await page.$('.swipeable-list-item')
  ok(!!row, '移动端任务行启用滑动手势')
  const rowBox = await row.boundingBox()
  await swipe(page, rowBox.x + rowBox.width - 12, rowBox.y + rowBox.height / 2, rowBox.x + 90, rowBox.y + rowBox.height / 2)
  await sleep(500)
  const readSwipe = () =>
    page.evaluate(() => {
      const item = document.querySelector('.swipeable-list-item')
      const content = item?.querySelector('.swipeable-list-item__content')
      const m = content ? new DOMMatrixReadOnly(getComputedStyle(content).transform) : null
      // SwipeAction 渲染为 div.swipe-action__trailing（该项的最后一个 = 删除）
      const actions = item ? item.querySelectorAll('.swipe-action__trailing') : []
      const del = actions.length ? actions[actions.length - 1] : null
      const rect = del?.getBoundingClientRect()
      return {
        offsetX: m ? m.e : 0,
        delVisible: !!rect && rect.width > 0 && rect.right <= window.innerWidth + 1,
      }
    })
  let swipeState = await readSwipe()
  if (swipeState.offsetX > -50) {
    // 偶发首次滑动未触发（动画/合成器时序），重试一次
    await swipe(page, rowBox.x + rowBox.width - 12, rowBox.y + rowBox.height / 2, rowBox.x + 60, rowBox.y + rowBox.height / 2, 20)
    await sleep(500)
    swipeState = await readSwipe()
  }
  ok(swipeState.offsetX < -60, `左滑后行内容移出 (offsetX=${Math.round(swipeState.offsetX)}px)`)
  ok(swipeState.delVisible, '删除等操作按钮已呼出')
  const afterSwipeTasks = await tasksFromStorage(page)
  ok(afterSwipeTasks.length === beforeCount && afterSwipeTasks.filter((t) => t.status === 'trashed').length === beforeTasks.filter((t) => t.status === 'trashed').length, '滑动本身未删除任务')
  await shot(page, 'm04-swipe-actions')

  // 5. 点按「删除」→ 进垃圾桶 + Toast 可撤销
  await page.evaluate(() => {
    const item = document.querySelector('.swipeable-list-item')
    const actions = item.querySelectorAll('.swipe-action__trailing')
    actions[actions.length - 1].click()
  })
  await sleep(600)
  const toastText = await page.evaluate(() => document.body.innerText)
  ok(toastText.includes('已移到垃圾桶'), '点按删除后 Toast 提示「已移到垃圾桶」')
  const afterDel = await tasksFromStorage(page)
  ok(afterDel.filter((t) => t.status === 'trashed').length === beforeTasks.filter((t) => t.status === 'trashed').length + 1, '任务进入垃圾桶')
  await shot(page, 'm05-deleted-toast')

  // 6. 撤销恢复
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '撤销')
    btn?.click()
  })
  await sleep(400)
  const afterUndo = await tasksFromStorage(page)
  ok(afterUndo.filter((t) => t.status === 'trashed').length === beforeTasks.filter((t) => t.status === 'trashed').length, '撤销后任务恢复')

  // 7. FAB 快速添加（自然语言日期）。FAB 用 pointer 事件打开，必须真实触摸。
  {
    const fab = await page.$('button[aria-label="添加任务"]')
    const fb = await fab.boundingBox()
    await page.touchscreen.tap(fb.x + fb.width / 2, fb.y + fb.height / 2)
    await sleep(600)
  }
  const fabInput = await page.$('input[placeholder*="准备做什么"]')
  ok(!!fabInput, 'FAB 打开快速添加抽屉')
  if (fabInput) {
    await fabInput.type('后天 09:00 自动化测试任务')
    await sleep(200)
    const previewText = await page.evaluate(() => document.body.innerText)
    ok(previewText.includes('识别日期'), '自然语言日期被识别')
    await shot(page, 'm07-quickadd')
    // 注意：侧栏抽屉常驻挂载且也有「添加」按钮，必须限定在快速添加抽屉内查找
    await page.evaluate(() => {
      const drawer = document.querySelector('[data-vaul-drawer]')
      const btn = [...(drawer?.querySelectorAll('button') ?? [])].find(
        (b) => b.textContent.trim() === '添加',
      )
      btn?.click()
    })
    await sleep(400)
    const afterAdd = await tasksFromStorage(page)
    ok(afterAdd.some((t) => t.title.includes('自动化测试任务') && t.dueAt), '快速添加成功且带识别的日期')
    // 等快速添加抽屉完全关闭，避免遮罩影响下一次滑动手势
    await page.waitForFunction(() => !document.querySelector('[data-vaul-drawer]'), { timeout: 5000 }).catch(() => {})
    await sleep(300)
  }

  // 8. 侧栏「＋添加」→ 标签管理页新建标签（新起页面形式）
  const openDrawer = async () => {
    await swipe(page, h1Point.x, h1Point.y, h1Point.x + 230, h1Point.y + 4)
    await sleep(450)
    const d = await drawerPanel()
    if (d && d.x !== 0) {
      await swipe(page, h1Point.x, h1Point.y, h1Point.x + 230, h1Point.y + 4)
      await sleep(450)
    }
    return drawerPanel()
  }
  d = await openDrawer()
  ok(d && d.x === 0, `再次右滑可打开菜单 (panel.x=${d?.x})`)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '添加')
    btn?.click()
  })
  await sleep(300)
  await page.evaluate(() => {
    const item = [...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent.trim() === '标签')
    item?.click()
  })
  await sleep(500)
  const tagPageH1 = await page.$eval('h1', (el) => el.textContent)
  ok(tagPageH1 === '标签', `「标签」入口打开独立标签页 (h1=${tagPageH1})`)
  await page.evaluate(() => document.querySelector('button[aria-label="添加标签"]')?.click())
  await sleep(400)
  const tagInput = await page.$('input[placeholder="名称"]')
  ok(!!tagInput, '标签页「添加标签」表单含名称输入')
  if (!tagInput) throw new Error('标签表单未打开')
  await tagInput.type('自动化标签')
  await page.evaluate(() => document.querySelector('button[aria-label="保存"]')?.click())
  await sleep(400)
  const tagsPageHasTag = await page.evaluate(() => document.body.innerText.includes('自动化标签'))
  ok(tagsPageHasTag, '保存后新标签出现在标签页列表')
  await shot(page, 'm08-tag-created')

  // 9. 点击标签行 → 标签视图
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('自动化标签'))
    btn?.click()
  })
  await sleep(500)
  const tagH1 = await page.$eval('h1', (el) => el.textContent)
  ok(tagH1 === '#自动化标签', `标签视图标题正确 (${tagH1})`)
  const viewAnim = await page.evaluate(() => !!document.querySelector('.animate-view-in'))
  ok(viewAnim, '视图切换带过场动画类')
  await shot(page, 'm09-tag-view')

  // 10. 点任务 → 半屏详情；详情内新建标签（点行中部，避开左侧完成按钮）
  // 新标签还没有任务；经侧栏回到「今天」视图（有点击任务的行）
  d = await openDrawer()
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent.replace(/\d+$/, '').trim() === '今天')
    btn?.click()
  })
  await sleep(500)
  await page.evaluate(() => {
    const row = document.querySelector('.swipeable-list-item')
    const r = row.getBoundingClientRect()
    // 点标题行右上侧：避开左下的清单/标签 chip（点击 chip 会跳转视图）
    window.__rowPoint = { x: r.x + r.width * 0.85, y: r.y + 14 }
  })
  {
    const p = await page.evaluate(() => window.__rowPoint)
    await page.touchscreen.tap(p.x, p.y)
  }
  await sleep(700)
  const sheetOpen = await page.evaluate(() => !!document.querySelector('[data-vaul-drawer]'))
  ok(sheetOpen, '点击任务打开半屏详情抽屉')
  // 点底栏「标签」
  await page.evaluate(() => document.querySelector('button[aria-label="标签"]')?.click())
  await sleep(300)
  const newTagInput = await page.$('input[placeholder="新建标签"]')
  ok(!!newTagInput, '详情标签面板有「新建标签」入口')
  if (newTagInput) {
    await newTagInput.type('详情标签')
    await page.keyboard.press('Enter')
    await sleep(400)
    const hasIt = await page.evaluate(() => document.body.innerText.includes('详情标签'))
    ok(hasIt, '详情面板新建标签成功并自动挂到当前任务')
  }
  await shot(page, 'm10-detail-tag')

  // 11. 详情内子任务：输入 + 空回车连续添加
  const subInput = await page.$('input[placeholder="添加子任务"]')
  if (subInput) {
    await subInput.type('自动化子任务A')
    await page.keyboard.press('Enter')
    await sleep(250)
    await page.keyboard.press('Enter') // 空输入也允许添加下一条
    await sleep(250)
    await subInput.type('自动化子任务B')
    await page.keyboard.press('Enter')
    await sleep(300)
    const subCheck = await page.evaluate(() => {
      const t = document.body.innerText
      return {
        a: t.includes('自动化子任务A'),
        placeholder: t.includes('新子任务'),
        b: t.includes('自动化子任务B'),
      }
    })
    ok(subCheck.a && subCheck.placeholder && subCheck.b, '子任务连续录入：实输 + 空回车（新子任务）+ 实输')
  } else {
    ok(false, '未找到「添加子任务」输入框')
  }
  await shot(page, 'm11-subtasks')

  // 12. 日历 / 四象限 / 更多 Tab 正常切换
  for (const [label, expect] of [
    ['日历', '月'],
    ['四象限', '四象限'],
  ]) {
    await page.evaluate((lb) => {
      const btn = document.querySelector(`nav[aria-label="主导航"] button[aria-label="${lb}"]`)
      btn?.click()
    }, label)
    await sleep(500)
    const txt = await page.evaluate(() => document.body.innerText)
    ok(txt.includes(expect), `底栏「${label}」Tab 可用`)
  }
  await shot(page, 'm12-tabs')

  // 13. 日历：左右滑切换月份 + 方向动画
  {
    await page.evaluate(() => {
      const btn = document.querySelector('nav[aria-label="主导航"] button[aria-label="日历"]')
      btn?.click()
    })
    await sleep(500)
    const title0 = await page.$eval('h1', (el) => el.textContent)
    const zone = await page.evaluate(() => {
      const r = document.querySelector('[data-no-swipe-menu]')?.getBoundingClientRect()
      return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width } : null
    })
    ok(!!zone, '日历网格滑动区存在')
    if (zone) {
      // 左滑 → 下个月
      await swipe(page, zone.x + zone.w * 0.3, zone.y, zone.x - zone.w * 0.3, zone.y + 2)
      await sleep(500)
      const titleNext = await page.$eval('h1', (el) => el.textContent)
      ok(titleNext !== title0, `日历左滑切换到下月 (${title0} → ${titleNext})`)
      ok(await page.evaluate(() => !!document.querySelector('.animate-month-next, .animate-month-prev')), '切月带方向动画')
      // 右滑 → 回上个月
      await swipe(page, zone.x - zone.w * 0.3, zone.y, zone.x + zone.w * 0.3, zone.y + 2)
      await sleep(500)
      const titleBack = await page.$eval('h1', (el) => el.textContent)
      ok(titleBack === title0, `日历右滑切回当月 (${titleBack})`)
    }
    await shot(page, 'm13-calendar')
  }

  // 14. 搜索页：圆角搜索框 + 任务/标签/清单范围 + 取消返回
  {
    d = await openDrawer()
    await page.evaluate(() => document.querySelector('button[aria-label="搜索"]')?.click())
    await sleep(500)
    const searchH1 = await page.$eval('h1', (el) => el.textContent)
    ok(searchH1 === '搜索', `搜索页打开 (h1=${searchH1})`)
    ok(!!(await page.$('input[placeholder="搜索"]')), '搜索页有搜索输入框')
    const pills = await page.evaluate(
      () =>
        [...document.querySelectorAll('button')].filter(
          (b) => ['任务', '标签', '清单'].includes(b.textContent.trim()) && b.getAttribute('aria-pressed') !== null,
        ).length,
    )
    ok(pills === 3, '范围切换 任务/标签/清单 齐备')
    await page.type('input[placeholder="搜索"]', '自动化')
    await sleep(400)
    await page.evaluate(() => {
      const pill = [...document.querySelectorAll('button')].find(
        (b) => b.textContent.trim() === '标签' && b.getAttribute('aria-pressed') !== null,
      )
      pill?.click()
    })
    await sleep(400)
    const tagHit = await page.evaluate(() => document.body.innerText.includes('自动化标签'))
    ok(tagHit, '「标签」范围能搜到已建标签')
    await shot(page, 'm14-search')
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消')
      btn?.click()
    })
    await sleep(500)
    const backH1 = await page.$eval('h1', (el) => el.textContent)
    ok(backH1 === '今天', `搜索页「取消」回到主页面 (h1=${backH1})`)
  }

  // 15. FAB 位置在视口变化（模拟键盘弹出/收起）下保持稳定
  {
    await page.evaluate(() => {
      const btn = document.querySelector('nav[aria-label="主导航"] button[aria-label="任务"]')
      btn?.click()
    })
    await sleep(500)
    const fabEl = await page.$('button[aria-label="添加任务"]')
    const fab0 = await fabEl.boundingBox()
    // 模拟键盘弹出：视口变矮
    await page.setViewport({ width: 390, height: 500, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
    await sleep(400)
    const fab1 = await fabEl.boundingBox()
    ok(
      fab1 && fab1.y >= 0 && fab1.y + fab1.height <= 500,
      `视口变矮（键盘）时 FAB 仍在可视区内 (y=${Math.round(fab1?.y ?? -1)})`,
    )
    // 键盘收起：视口还原
    await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
    await sleep(400)
    const fab2 = await fabEl.boundingBox()
    ok(
      Math.abs(fab2.y - fab0.y) < 1.5,
      `视口恢复后 FAB 回到原位 (Δ=${(fab2.y - fab0.y).toFixed(1)}px)`,
    )
  }

  ok(errors.length === 0, `无页面错误 (${errors.length})`)
  if (errors.length) console.log(errors.slice(0, 5).join('\n'))
  await page.close()
}

// ---------------------------------------------------------------- desktop
async function desktopSuite(browser) {
  console.log('\n——— 桌面端（1280×800）———')
  const page = await browser.newPage()
  const errors = []
  watchErrors(page, errors)
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  // 与移动端共用同一浏览器 profile —— 先清空 localStorage 得到全新种子数据
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.waitForSelector('h1')
  await sleep(400)

  // 1. 侧栏含「明天」智能清单
  const hasTomorrow = await page.evaluate(() =>
    [...document.querySelectorAll('aside button')].some((b) => b.textContent.includes('明天')),
  )
  ok(hasTomorrow, '桌面侧栏含「明天」智能清单')

  // 2. 侧栏标签有计数（紧急 tag）
  const tagCount = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('紧急'))
    return btn ? btn.textContent : ''
  })
  ok(/\d/.test(tagCount), `侧栏标签显示计数 (${tagCount.trim()})`)

  // 3. QuickAdd 添加任务（无日期词，避免 chrono 依当前时刻滚到明天）
  const qa = await page.$('input[placeholder*="添加任务"]')
  await qa.type('开评审会')
  await page.keyboard.press('Enter')
  await sleep(400)
  const added = await tasksFromStorage(page)
  ok(added.some((t) => t.title.includes('开评审会')), '桌面 QuickAdd 成功添加')

  // 4. hover 行操作：置顶 / 删除
  await page.hover('.group')
  await sleep(350)
  const hoverBtns = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.group')].find((r) => r.querySelector('button[title="置顶"]'))
    if (!row) return null
    const pin = row.querySelector('button[title="置顶"]')
    return { visible: getComputedStyle(pin.parentElement).opacity === '1' }
  })
  ok(hoverBtns && hoverBtns.visible, '桌面 hover 显示 置顶/删除 操作')

  // 5. 打开详情 → 添加子任务（含空回车）。切到「所有」便于定位新任务
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('aside button')].find((b) => b.textContent.replace(/\d+$/, '').trim() === '所有')
    btn?.click()
  })
  await sleep(400)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.group')].find((r) => r.textContent.includes('开评审会'))
    row.click()
  })
  await sleep(400)
  const detailShown = await page.evaluate(() => document.body.innerText.includes('日期与提醒'))
  ok(detailShown, '点击任务打开右侧详情面板')
  const subInput = await page.$('input[placeholder="添加子任务"]')
  ok(!!subInput, '详情面板含「添加子任务」输入框')
  if (subInput) {
    await subInput.type('准备材料')
    await page.keyboard.press('Enter')
    await sleep(200)
    await page.keyboard.press('Enter')
    await sleep(200)
    await subInput.type('发邀请')
    await page.keyboard.press('Enter')
    await sleep(300)
    const t = await page.evaluate(() => document.body.innerText)
    ok(t.includes('准备材料') && t.includes('新子任务') && t.includes('发邀请'), '桌面子任务：空回车也允许连续添加')
  }
  await shot(page, 'd01-detail-subtasks')

  // 6. 详情面板新建标签
  await page.evaluate(() => document.querySelector('button[aria-label="标签"]')?.click())
  await sleep(250)
  const tagInput = await page.$('input[placeholder="新建标签"]')
  if (tagInput) {
    await tagInput.type('桌面标签')
    await page.keyboard.press('Enter')
    await sleep(300)
    const t = await page.evaluate(() => document.body.innerText)
    ok(t.includes('桌面标签'), '桌面详情面板可新建标签')
  }
  await shot(page, 'd02-detail-tag')

  // 7. 删除 → 垃圾桶 → hover 恢复 / 永久删除
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.group')].find((r) => r.textContent.includes('开评审会'))
    row.querySelector('button[title="删除"]')?.click()
  })
  await sleep(400)
  let t = await page.evaluate(() => document.body.innerText)
  ok(t.includes('已移到垃圾桶'), '桌面删除有 Toast')

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('垃圾桶'))
    btn?.click()
  })
  await sleep(500)
  const trashRowBtns = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.group')].find((r) => r.textContent.includes('开评审会'))
    if (!row) return null
    return {
      restore: !!row.querySelector('button[title="恢复"]'),
      permDel: !!row.querySelector('button[title="永久删除"]'),
      pin: !!row.querySelector('button[title="置顶"]'),
    }
  })
  ok(trashRowBtns && trashRowBtns.restore && trashRowBtns.permDel && !trashRowBtns.pin, `垃圾桶 hover 操作按状态变为 恢复/永久删除 (${JSON.stringify(trashRowBtns)})`)
  await shot(page, 'd03-trash')

  // 8. 恢复
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.group')].find((r) => r.textContent.includes('开评审会'))
    row.querySelector('button[title="恢复"]')?.click()
  })
  await sleep(400)
  const restored = await tasksFromStorage(page)
  ok(restored.find((t2) => t2.title.includes('开评审会'))?.status === 'todo', '垃圾桶恢复成功')
  ok(errors.length === 0, `无页面错误 (${errors.length})`)
  if (errors.length) console.log(errors.slice(0, 5).join('\n'))
  await page.close()
}

// ---------------------------------------------------------------- run
// 桌面套件需要 (hover:hover) 媒体查询生效（Tailwind group-hover 规则被它包住），
// headless 默认 hover:none，用 blink-settings 模拟带 hover 的鼠标设备。
const browser = await launch()
const desktopBrowser = await launch([
  '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
])
try {
  await mobileSuite(browser)
  await desktopSuite(desktopBrowser)
} finally {
  await browser.close()
  await desktopBrowser.close()
}

console.log(`\n========== 结果: ${passed} 通过, ${failures.length} 失败 ==========`)
if (failures.length) {
  failures.forEach((f) => console.log(`  ❌ ${f}`))
  writeFileSync('screenshots/e2e/failures.txt', failures.join('\n'), 'utf8')
  process.exit(1)
}
