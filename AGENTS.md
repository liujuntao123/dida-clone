# dida-clone · Agent 协作规范

面向 AI agent / 新维护者的最小约定。遇到本文件与代码现状冲突时，以代码为准并回头更新本文件。

## 发版 / 版本号（⚠️ 历史踩坑：只改 package.json 漏了安卓）

升版本号时必须同步改**两处**，缺一不可：

| 文件 | 字段 |
|------|------|
| `package.json` | `version` |
| `android/app/build.gradle` | `versionCode`（整数 +1）、`versionName`（同 package.json） |

完整发版顺序：

```bash
# 1. 改 package.json + android/app/build.gradle
# 2. 验证（见下节）后提交，例如：feat(...) 可与版本提交合并为一条
git push origin main
git tag -a v0.10.0 -m "..." && git push origin v0.10.0
# 3. 完成 —— 推送 v* tag 会自动触发 android.yml：构建签名 APK/AAB 并创建 GitHub Release
```

- Tag 一律用附注标签（`git tag -a`），命名 `vX.Y.Z`。
- **推 tag 即出包**：`android.yml` 监听 `v*` tag push，构建完成后自动创建 GitHub Release 并挂上 APK/AAB，无需任何手动触发（`gh workflow run android.yml` 仅在需要补构建时使用）。
- **Release 说明自动生成**：workflow 的「Generate release notes」步骤取「上一个 tag..当前 tag」的提交列表（剥掉尾部 `, vX.Y.Z` 后缀）作为「更新内容」，后接固定的安装 / 产物说明。因此**提交描述就是发布日志**——请写成用户能看懂的中文变更说明，别写「fix: 修复 bug」这类无信息量描述。
- Tag 推送后若发现遗漏（如版本号），可直接重打并 `git push -f origin vX.Y.Z`——前提是该 tag 还没有对应的 Release/APK（重打 tag 会重新触发构建；已生成的 Release 需手动删掉再重跑）。

## 验证流程（改完必跑）

```bash
npx tsc -b && npm run lint && npm run build
npm run preview -- --port 4173 &     # 或后台起服务
node scripts/e2e-check.mjs           # 53 项断言，移动端 + 桌面端
```

E2E 的 headless 特殊性（改脚本/环境时注意）：

- Chrome 154+ 已无视 `--overscroll-history-navigation`，防横滑误导航靠应用层 `overscroll-behavior-x: none`（见 `src/index.css`）+ AppLayout 的非 passive touchmove 守卫。
- ⚠️ **禁止给 `button` 等元素全局加 `touch-action: manipulation`**：它会改变合成器的手势接管方式，令 touchmove 变为 non-cancelable，横滑守卫失效 → 左右滑直接触发浏览器历史导航（实测回归过一次）。同理，自定义横滑区域（如日历切月）要显式设 `touch-action: pan-y`，否则手势会被浏览器抢走。
- Tailwind 的 `group-hover` 等规则包在 `@media (hover:hover)` 里，headless 默认 `hover:none`；桌面套件用 `--blink-settings=primaryHoverType=2,...` 模拟鼠标设备（见 launch 调用）。
- 日期类测试数据别写死时间词（如「14:00」），chrono-node 会按当前时刻滚到明天。
- 侧栏抽屉是**常驻挂载**（仅位移隐藏），其「添加」按钮与快速添加抽屉的「添加」重名——e2e 里操作快速添加必须在 `[data-vaul-drawer]` 内查找按钮。
- 详情抽屉（vaul）用 pointer 事件关闭遮罩，`el.click()` 关不掉——e2e 里通过切换 Tab / 视图让 store 清掉 `selectedTaskId`。

## 代码约定 / 已知陷阱

- **返回键导航**（`src/lib/backNav.ts`）：应用不用浏览器历史；Android 返回键走 `handleAppBack()` 的处理器栈。新增临时层（抽屉 / 弹层 / 子页面）时用 `useBackHandler(active, handler)` 注册；视图层兜底（侧栏 → 详情 → 全屏模块页 → 主页面）已内置。
- **FAB 位置**（`MobileFab.tsx`）：存 `{ side, gap }`，gap 是到移动底栏顶部的距离（与视口高度无关）；钳制只发生在渲染期，**resize 时绝不回写 localStorage**（否则键盘等瞬时视口变化会永久顶飞 FAB，历史 bug）。键名 v3，不迁移旧位置。
- **react-swipeable-list**：其 content 容器是 `display:flex`，任务行必须 `w-full` 撑满，否则行右侧出现「点不中」死区；`fullSwipe` 保持关闭——左滑只呼出按钮、点按才触发，不许改回「滑动即删除」。**呼出阈值 = 操作按钮总宽**（拖动超过 actions 总宽才保持展开），按钮数量/宽度要克制（现状：尾部 3×56px ≈ 168px、头部 2×64px），加按钮前先想滑动手感。
- **右滑开菜单手势**（`AppLayout.tsx`）：热点元素靠 `SWIPE_HOTSPOT_SELECTOR` 排除。新增可交互/可拖拽组件时，要么命中既有选择器，要么给元素加 `data-no-swipe-menu`。
- **动画**：统一用 `src/index.css` 里的 `animate-fade-in / animate-slide-up / animate-view-in / animate-month-*`，新增动画必须兼顾 `prefers-reduced-motion`。
- **dnd-kit 拖拽**：触端拖拽把手要加 `touch-none`，且自定义 `onPointerDown` 会覆盖 `{...listeners}` 里的同名 handler——需仿照子任务行的写法手动回调 `listeners?.onPointerDown?.(e)`；`DragOverlay` 会继承被拖节点（常是 24px 把手）的尺寸，children 必须显式设宽。
- **移动端安全区**：顶栏 / 抽屉 / 设置 / 看板等自绘头部的页面，注意 `env(safe-area-inset-*)`；触控目标 ≥ 44px。
- 状态都在 `useAppStore`（zustand persist）；给 store 加字段时检查 `partialize`/`merge` 是否需要迁移旧 localStorage。

## 提交规范

Conventional Commits，描述可中文：`feat(scope): 中文说明, vX.Y.Z`。功能提交与版本 bump 可合并为一条；纯 chore 可单独提交。
