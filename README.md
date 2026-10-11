# 滴答清单 · Web 复刻（P0 + P1）

基于 Vite + React + TypeScript + Tailwind CSS 的滴答清单风格任务管理应用。  
本地 Zustand + localStorage；可选 **Cloudflare Worker + D1** 做单用户云同步（self-host）。

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

## 云同步（Cloudflare）

单用户、Access Key 鉴权，适合私人 self-host。多设备填同一 Worker URL + Key 即可同步。

### 架构

```
前端 (Zustand persist)
    │  Authorization: Bearer <ACCESS_KEY>
    ▼
Cloudflare Worker  dida-clone-sync
    │
    ▼
D1  dida-clone-db  (表 app_state：整包 JSON + revision)
```

API：

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/health` | 否 | 健康检查 |
| GET | `/api/state` | 是 | 拉取 `{ revision, updatedAt, state }` |
| PUT | `/api/state` | 是 | 带 `revision` 乐观锁上传；落后则 409 |
| POST | `/api/state/force` | 是 | 强制覆盖云端 |

请求头任选其一：`Authorization: Bearer <key>` 或 `X-Access-Key: <key>`。

### 部署 Worker

前置：已安装 [Wrangler](https://developers.cloudflare.com/workers/wrangler/)，并 `wrangler login`（或设置 `CLOUDFLARE_API_TOKEN`）。

```bash
cd worker
npm install

# 若尚未创建 D1（只需一次）
npx wrangler d1 create dida-clone-db
# 把返回的 database_id 写入 wrangler.toml

# 建表
npx wrangler d1 execute dida-clone-db --remote --file=schema.sql

# 部署
npx wrangler deploy

# 设置 Access Key（强随机，勿提交到 Git）
openssl rand -base64 32
printf '%s' '你的密钥' | npx wrangler secret put ACCESS_KEY
```

部署后地址形如：`https://dida-clone-sync.<subdomain>.workers.dev`。

本地凭据可写在仓库根目录 `.sync-credentials.local`（已 gitignore）：

```
WORKER_URL=https://dida-clone-sync.xxx.workers.dev
ACCESS_KEY=...
```

### 在设置页填写

1. 打开应用 → 侧栏 **设置**
2. **Sync API Base URL**：Worker 根地址（不要带尾斜杠路径以外的内容；填到 `.workers.dev` 即可）
3. **Access Key**：与 `wrangler secret put ACCESS_KEY` 相同
4. **保存配置** → **测试连接** → **立即同步**

行为：

- 启动后若已配置：自动拉取
- 本地变更后约 2 秒 debounce 上传
- 冲突时提示选择「用云端」或「强制上传本地」

### 手动测 API

```bash
BASE=https://dida-clone-sync.xxx.workers.dev
KEY=你的密钥

curl -s "$BASE/api/health"
curl -s -H "Authorization: Bearer $KEY" "$BASE/api/state"
curl -s -X PUT -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"revision":0,"state":{"lists":[],"tags":[],"tasks":[],"sessions":[],"theme":"light"}}' \
  "$BASE/api/state"
```

## 技术栈

| 用途 | 库 |
|------|-----|
| 框架 | Vite + React + TypeScript |
| 样式 | Tailwind CSS v4 |
| 状态 / 持久化 | Zustand (+ persist) |
| 云同步 | Cloudflare Worker (Hono) + D1 |
| 安卓壳 | Capacitor 8 + GitHub Actions (assembleRelease) |
| 日期 | dayjs + chrono-node |
| 拖拽 | @dnd-kit |
| 抽屉/底部弹层 | vaul |
| 滑动操作 | react-swipeable-list |
| Markdown | react-markdown + remark-gfm |

## 功能对照

### P0 / P1

见此前清单：智能清单、任务详情（桌面侧栏 / 移动端底部抽屉，双档吸顶）、识日期、提醒、标签/检查项、日历月视图、看板、四象限、搜索过滤、深浅色、垃圾桶（侧栏可直达）、撤销 Toast 等。

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
- 新增 `scripts/e2e-check.mjs`：puppeteer + Chrome 的自动化验证（移动手势 / 标签 / 子任务 / 垃圾桶 / 动画类，39 项断言）。

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

安装后打开 App → **设置**，填入与 Web 相同的 Sync API Base URL + Access Key，即可与浏览器/其他设备同步（API 为 HTTPS `workers.dev`）。

## 目录结构

```
src/           # 前端
android/       # Capacitor Android 工程（提交到 Git，供 CI）
worker/        # Cloudflare Worker + D1 schema
scripts/       # e2e-check.mjs：puppeteer 自动化验证（39 项断言）
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
- 云同步为整包状态 + revision，非细粒度 CRDT；冲突需手动选云端或强制上传。
- Access Key 存 localStorage，勿在公共电脑长期登录。
- 安卓为自签 release；更新请始终用同一 keystore。未专门适配 Google Play 上架流程。
