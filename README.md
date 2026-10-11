# 滴答清单 · Web 复刻（P0 + P1）

基于 Vite + React + TypeScript + Tailwind CSS 的滴答清单风格任务管理应用。  
本地 Zustand + localStorage（离线优先）；**Cloudflare Worker + D1** 多用户账户云同步（邮箱注册，self-host）。

## 启动

```bash
cd dida-clone
npm install
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

浏览器打开终端提示的本地地址（默认 `http://localhost:5173`）。

## 账户与云同步（Cloudflare）

多用户账户体系（**better-auth**）+ 实体级 LWW 云同步。注册只需**邮箱 + 密码**；
本地永远可用，登录后自动多端同步。

### 架构

```
前端 (Zustand persist，离线优先)
    │  Authorization: Bearer <session token>
    ▼
Cloudflare Worker (Hono)
    ├─ /api/auth/*      better-auth：注册 / 登录 / 会话 / 改密 / 设备管理
    ├─ /api/sync        实体级 LWW 同步（状态基 + 单调游标，详见 docs/sync-design.md）
    ├─ /api/export      全量导出（JSON）
    ├─ /admin/api/*     后台管理 API（role=admin）
    └─ /admin/*         后台管理 SaaS（独立 SPA，静态资产托管）
    ▼
D1：entity（实体+墓碑）/ data_seq（游标）/ sync_log / audit_log
```

### 一致性设计（要点）

- **状态基同步**：每轮全量上送本地实体，天然幂等——断网、超时、应用被杀都无损；
- **实体级 LWW**：以 `(updatedAt, deviceId)` 裁决，双端对任意交错顺序收敛到同一状态；
  时钟超前服务器 2 分钟以上会被钳制（防漂移设备霸权）；
- **单调游标**：服务端为每用户分配单调 seq，客户端只拉增量；cursor 丢失从 0 重拉自愈；
- **墓碑删除**：删除以墓碑实体跨端传播；
- **首登两阶段**：云端有数据则整体采用（种子不反噬），为空才推种子。

完整设计（边界场景对照表、部署运维）见 [docs/sync-design.md](./docs/sync-design.md)。

### 部署 Worker

前置：安装 [Wrangler](https://developers.cloudflare.com/workers/wrangler/) 并 `wrangler login`。

```bash
cd worker && npm install

# 建表（一次；schema 与 v1 不兼容，旧 app_state 表会被清除）
npx wrangler d1 execute dida-clone-db --remote --file=schema.sql

# 密钥（勿提交 Git）
npx wrangler secret put BETTER_AUTH_SECRET    # 强随机串：openssl rand -base64 32
npx wrangler secret put ADMIN_EMAIL           # 该邮箱注册即管理员

# 构建后台 SPA 并部署（wrangler.toml [assets] 托管在 /admin 路径）
npm run deploy
```

如需关闭开放注册：`wrangler.toml` 的 `[vars]` 里加 `DISABLE_SIGNUPS = "true"`。

### 多端登录

- Web：访问部署地址，注册/登录即可；
- 安卓 App：登录页「高级选项」可改服务地址（默认连内置的线上 Worker；
  自托管构建时用 `VITE_API_BASE_URL` 环境变量写入自己的地址）；
- 后台管理：浏览器访问 `https://<worker-domain>/admin/`，用 ADMIN_EMAIL 账号登录。

### 手动测 API

```bash
BASE=https://dida-clone-sync.xxx.workers.dev

curl -s "$BASE/api/health"
# 注册（响应头 set-auth-token 即会话令牌）
curl -s -D- -o /dev/null -X POST "$BASE/api/auth/sign-up/email" \
  -H 'Content-Type: application/json' -H 'Origin: https://example.com' \
  -d '{"email":"you@example.com","password":"password123","name":"you"}'
# 同步（Bearer 令牌；实体全量上送 + cursor 增量拉取）
curl -s -X POST "$BASE/api/sync" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"dev1","cursor":0,"entities":{"tasks":[],"lists":[],"tags":[],"settings":[]}}'
```

## 技术栈

| 用途 | 库 |
|------|-----|
| 框架 | Vite + React + TypeScript |
| 样式 | Tailwind CSS v4 |
| 状态 / 持久化 | Zustand (+ persist) |
| 账户 / 云同步 | better-auth + Cloudflare Worker (Hono) + D1（实体级 LWW） |
| 安卓壳 | Capacitor 8 + GitHub Actions (assembleRelease) |
| 日期 | dayjs + chrono-node |
| 拖拽 | @dnd-kit |
| 抽屉/底部弹层 | vaul |
| 滑动操作 | 自研 SwipeRow（轻量手势行） |
| Markdown | react-markdown + remark-gfm |

## 功能对照

### P0 / P1

见此前清单：智能清单、任务详情（桌面侧栏 / 移动端底部抽屉，双档吸顶）、识日期、提醒、标签/检查项、日历月视图、看板、四象限、搜索过滤、深浅色、垃圾桶（侧栏可直达）、撤销 Toast 等。

### v0.12 优化：账户体系 + 云同步重做（breaking）

- **用户体系**：引入 better-auth——注册只需**邮箱 + 密码**（用户名自动派生），Bearer 令牌鉴权，Web / 安卓壳 / curl 通吃；30 天滑动会话、修改密码、登录设备管理、远程注销、账号注销、数据导出一应俱全。
- **同步协议 v2（实体级 LWW + 单调游标）**：替代旧「整包 JSON + revision 乐观锁」。状态基全量上送（幂等，断网/被杀无损）+ 实体级 `(updatedAt, deviceId)` 裁决（双端任意交错收敛一致）+ 时钟漂移钳制 + 墓碑删除 + 单调 seq 增量拉取（cursor 丢失自愈）；冲突**静默收敛**，不再需要手动选「用云端 / 强制上传」。完整设计见 docs/sync-design.md。
- **后台管理 SaaS**（`admin/`，独立浅色 SPA，构建后由 Worker 托管在 `/admin`）：总览（用户/任务/会话/近 7 天同步曲线）、用户管理（搜索/封禁/解封/删除）、日志（同步流水 + 审计，保留 90 天）、墓碑清理维护。管理员由 `ADMIN_EMAIL` secret 指定，支持 `DISABLE_SIGNUPS` 关闭注册。
- **设置页改造**：原「云同步」（URL + Access Key + 冲突处理）整节移除，改为「账户 / 数据 / 安全」——同步状态与手动同步、服务地址（高级）、导出 JSON、修改密码、登录设备、退出登录、注销账号。
- **登录页**：全新登录/注册双 Tab 页（未登录自动呈现），注册仅需邮箱 + 密码。
- **worker schema 重写**：`app_state` 整包表移除，新增 better-auth 四表 + entity/data_seq/sync_log/audit_log；API 全部经 Bearer 会话鉴权。
- e2e 改造：断言套件自动注册测试账号并注入登录态（`npm run e2e` 一键拉起 wrangler dev + preview 跑完回收）；新增 `scripts/auth-flow-check.mjs` 账户/同步浏览器冒烟（注册→首同步→跨端编辑→采纳→登出）。

### v0.11 优化

- **设置页瘦身**：清单 / 标签等管理入口不再放进设置页（管理统一走侧栏「＋添加」菜单）。
- **新建任务抽屉重做**（对齐滴答清单）：顶部大标题输入 + 底部工具条（日期 / 优先级 / 标签 / 移动清单 / 描述）+ 右侧圆形发送按钮；日期支持今天 / 明天 / 自选时间，优先级、标签、清单可在添加时直接指定，标签支持就地新建；已选项以胶囊展示、点 × 即移除，自然语言识日期照常生效。
- **全站字号协调**：正文统一 14px、次要文字 12px、模块页页头 16px、大标题（日历 / 四象限 / 详情）20px，层级更细腻、信息密度更舒适。
- e2e 扩充到 **53 项断言**（新增新建抽屉工具条 / 属性胶囊 / 优先级随任务落库回归）。
- **v0.11.1 修复**：设置页「管理」区整体移除；新建抽屉高度自适应修复——工具面板打开时自动收起键盘、面板互斥（描述 ↔ 工具面板），并关闭 vaul 键盘重排（它会用内联像素冻结抽屉高度，导致开面板后高度卡死 / 裁切），键盘避让改由 visualViewport 自管（Android 压缩式键盘零开销）。
- **v0.11.2 优化**：任务行左右滑操作重做——按钮内容垂直居中、固定宽度不再随拖动拉伸（覆写 lib 的 flex 拉伸与顶/底对齐）；拖动止点钳制在按钮总宽，杜绝按钮全开后继续拖出一截空白；回弹动画 0.5s→0.26s 更跟手；**点击行内空白或行外任意空白即收起呼出按钮**，执行动作（完成/置顶/明天/移动）后自动收起；起手阈值提高到 14px，先确认横向意图再接管手势。e2e 扩充到 **55 项断言**。
- **v0.11.3 优化**：
  - **滑动步长大幅缩短**：移除 react-swipeable-list（其呼出阈值硬编码为「按钮总宽」168px），改为自研轻量手势行 `SwipeRow`——**拖过 ~64px 或一记快扫即呼出**，反向拖过一半 / 反向快扫即收起，超出按钮宽度有橡皮筋阻尼，手势残留 click 自动吞掉（防误开详情），弹簧回弹更跟手。
  - **详情抽屉移除「检查事项」**：子任务即检查事项，功能合并；底部工具条只剩 标签 / 子任务，进度环只统计子任务。
  - **子任务行对齐修复**：勾选框 / 删除 / 拖拽把手统一 6×6 槽位居中，与首行文字对齐。
  - **四象限字号再缩小一档**（14px→13px）。
  - **任务行右侧新增子任务进度环**（18px 迷你环形图，悬停可见 x/y），替代原「1/3」文字徽标；种子数据同步把示例检查项改为子任务。
- **v0.11.4 优化**：
  - **滑动操作按钮精简为纯图标**：只保留 移动 / 删除 两个按钮（2×52px），去掉「明天」与左侧的 完成 / 置顶（完成走行首勾选框，置顶在详情菜单），呼出面板更紧凑。
  - **子任务行对齐再修**：单行行改用垂直居中布局，勾选框 / 标题 / 删除 / 拖拽把手完全居中对齐。
- **v0.11.5 修复**：呼出按钮改为 44px 圆形图标按钮（垂直居中、8px 间距、右侧 12px 边距），替换整条全高色块——旧布局里 `.swipe-action` 的 `align-items: stretch` 规则会同优先级压过按钮自身的居中设置，导致图标上下不居中，色块观感也偏重。

### v0.10 优化

- **返回键导航**：Android 硬件返回键按层级回退——快速添加抽屉 / 任务详情 / 弹层 → 侧栏 → 全屏模块页（搜索 / 清单 / 标签 / 过滤器 / 设置）→ 主页面，退无可退才退出应用（`src/lib/backNav.ts` 处理器栈，新弹层用 `useBackHandler` 一行接入）。
- **FAB 位置修复**：定位模型重构为「到底栏顶部的距离」（与视口高度无关），键盘弹出 / 收起、页面切换都不再让 FAB 漂移；钳制只在渲染期生效，瞬时视口变化不会污染保存的位置；默认位置自动适配底部安全区（刘海 / 手势条）。
- **日历月视图重做**：**左右滑动切换月份**（带方向过场动画）、头部大标题 + 今天 / 翻月按钮、任务点指示（最多 3 个）、选中日任务卡片化（时间 / 优先级 / 清单），空日优雅空态。
- **搜索页重做**（对齐滴答清单）：圆角搜索框 + 右侧「取消」，**任务 / 标签 / 清单三个范围**可切换，标签 / 清单命中后点击直达对应视图。
- **详情抽屉打磨**：弹出层淡入动画、Esc / 返回键收起弹出层、菜单新增置顶、底栏工具条居中、检查项勾选样式与子任务统一（品牌色）。
- **一致性细节**：切换 Tab / 视图自动收起任务详情（不再悬浮在别的页面）；设置页补返回头部；`notifiedReminders` 自动修剪不再无限增长；计数用等宽数字；系统字体栈优先（SF / 鸿蒙 / MiSans）；键盘导航焦点环、品牌色选区。
- e2e 扩充到 **51 项断言**（新增日历切月 / 搜索范围 / FAB 视口稳定性回归）。

### v0.7 优化

- **移动端手势**：
  - 任意**非热点区域右滑**即可打开侧栏菜单（任务行 / 按钮 / 输入框 / 可拖拽卡片等热点不误触），菜单打开时**左滑收起**；`overscroll-behavior-x: none` 防止浏览器把横滑当成「前进/后退」。
  - 任务行**左滑改为呼出操作按钮**（今天 / 明天 / 移动 / 删除），需点按才触发，不再「一滑就删」；右滑仍是完成 / 置顶。
- **子任务连续录入**：回车即添加，**空输入也会创建「新子任务」**并保持焦点，方便批量录入后统一改名。
- **标签功能闭环**：移动端侧栏新增「添加标签」；任务详情标签面板支持**就地新建标签**（重名自动复用）并自动挂到当前任务；任务行上的清单 / 标签徽章可点击跳转对应视图；侧栏标签与清单显示待办计数。
- **逻辑一致性**：桌面 hover 操作按任务状态变化（垃圾桶行 = 恢复 / 永久删除，已放弃行 = 恢复 / 删除）；已完成任务详情菜单补上「删除」；修复移动端任务行右侧约 1/3 宽度的「点不中」死区（swipeable-list flex 容器导致行未撑满）。
- **过场动画**：侧栏抽屉开合（滑入滑出 + 遮罩淡入淡出）、视图切换轻量淡入、分组展开、「移动到清单」弹层滑入；遵循 `prefers-reduced-motion`。
- 看板 / 设置页补充状态栏安全区（safe-area-inset-top）。
- 新增 `scripts/e2e-check.mjs`：puppeteer + Chrome 的自动化验证（移动手势 / 标签 / 子任务 / 垃圾桶 / 动画类，历史基线 39 项断言）。

### v0.6 优化

- **子任务**：任务详情内可添加 / 勾选 / 拖拽排序子任务（TickTick 同款圆角勾选框 + 拖拽手柄），子任务计入详情页进度环，列表行显示 `x/y` 进度徽标；点击子任务进入其详情（顶部可返回父任务）。
- **内联「已完成」**：所有 / 今天 / 明天 / 最近7天 / 收集箱 / 清单 / 标签视图底部「已完成」分组原地展开，不再跳转到「已完成」Tab。
- 输入框全面无边框化（筛选、侧栏、详情、设置），与滴答清单风格一致。
- 修复移动端新增任务后 FAB 位置漂移（键盘弹出触发的 viewport resize 不再重新定位）。
- 桌面侧栏智能清单显示计数；检查项 / 子任务支持悬停删除。

### 明确不做（P2）

习惯、倒数日、协作、时间线、多用户 OAuth、附件等。

### 安卓（Capacitor + GitHub Actions）

用官方 [Capacitor](https://capacitorjs.com/) 把 Web 包进 Android WebView；在 GitHub Actions 上出 **release 签名 APK / AAB**（无需本机 Android Studio）。

签名密钥存在仓库 **GitHub Secrets**（`ANDROID_KEYSTORE_BASE64` 等），**切勿把 `.jks` / 密码提交到 Git**。本机备份目录：`.android-release/`（已 gitignore）。

#### 本地（可选）

需本机 JDK 21 + Android SDK，以及本地 `android/keystore.properties`（指向 `.android-release/dida-release.jks`，已 gitignore）。

```bash
npm install
npm run build:android   # = npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

#### 用 GitHub Actions 出包（推荐）

1. 打开仓库 **Actions** → **Build Android APK**
2. 点 **Run workflow**
   - 默认：只上传 artifact `app-release`（APK + AAB）
   - 勾选 `create_release` 并填 `release_tag`（如 `v0.1.0`）：额外创建 **GitHub Release** 并附上 APK
3. 跑完后在该次 run 的 **Artifacts** 下载 `app-release`，或到 **Releases** 页下载

也可 CLI：

```bash
# 仅打 release APK artifact
gh workflow run android.yml --repo liujuntao123/dida-clone

# 打包并创建 GitHub Release
gh workflow run android.yml --repo liujuntao123/dida-clone \
  -f create_release=true -f release_tag=v0.1.0

# 或推送 tag（附注标签，见 AGENTS.md 发版清单）
git tag -a v0.1.0 -m "v0.1.0" && git push origin v0.1.0
```

#### App 内云同步

安装后打开 App，用同一账号**登录**即可与浏览器/其他设备同步（服务地址默认内置；
自托管时在登录页「高级选项」填写自己的 Worker 地址）。设置页支持改密、设备管理与导出。

## 目录结构

```
src/           # 前端
android/       # Capacitor Android 工程（提交到 Git，供 CI）
worker/        # Cloudflare Worker：better-auth + 实体级同步 + admin API
admin/         # 后台管理 SaaS（独立 Vite 应用，构建后由 Worker 托管在 /admin）
scripts/       # e2e-check.mjs：puppeteer 自动化验证（55 项断言）
.github/workflows/android.yml  # 打 release APK / Release（手动触发）
screenshots/   # 界面截图
AGENTS.md      # AI agent / 维护者协作规范（发版清单、已知陷阱）
```

> 维护者 / AI agent 请先读 [AGENTS.md](./AGENTS.md)：升版本要同时改 `package.json` 与 `android/app/build.gradle`，改完跑一遍 e2e 再提交。


## 已知限制

- 提醒仅在页面打开时生效；通知权限请在「设置 → 通知」中主动授予（页面加载时不再自动请求，避免被浏览器静默拒绝）。
- 检查项不支持拖拽排序（子任务支持）。
- 重复任务的下次实例不携带子任务（检查项会重置）。
- 移动端详情抽屉内删除检查项 / 子任务需点入该项详情后从菜单删除（桌面为悬停删除）。
- 同步为实体级 LWW：并发编辑同一实体的不同字段时整条以较新一方为准（不做字段级合并），详见 docs/sync-design.md。
- 会话令牌存 localStorage，公共电脑用完请退出登录。
- 安卓为自签 release；更新请始终用同一 keystore。未专门适配 Google Play 上架流程。
