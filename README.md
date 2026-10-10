# 滴答清单 · Web 复刻（P0 + P1）

基于 Vite + React 18 + TypeScript + Tailwind CSS 的滴答清单风格任务管理应用。数据本地持久化（Zustand + localStorage），无需后端。

## 启动

```bash
cd /workspace/dida-clone
npm install
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

浏览器打开终端提示的本地地址（默认 `http://localhost:5173`）。

## 技术栈

| 用途 | 库 |
|------|-----|
| 框架 | Vite + React + TypeScript |
| 样式 | Tailwind CSS v4 |
| 状态 / 持久化 | Zustand (+ persist) |
| 路由 | react-router-dom（已接入，当前以侧栏视图切换为主） |
| 日期 | dayjs |
| 自然语言日期 | chrono-node（中文 `chrono.zh`） |
| 日历 | react-day-picker |
| 拖拽 | @dnd-kit/core + sortable |
| Markdown | react-markdown + remark-gfm |
| 图标 | lucide-react |
| 类名 | clsx + tailwind-merge |

## 功能对照

### P0

- [x] 收集箱 + 普通清单 CRUD（颜色预设）
- [x] 智能清单：收集箱、今天、明天、最近7天、全部
- [x] 任务 CRUD：标题、日期时间、优先级、清单、完成/删除
- [x] 任务详情 + 列表勾选完成
- [x] 列表视图 + 按日期/优先级排序
- [x] 自然语言日期识别（chrono-node 中文）
- [x] 基础提醒（Notification API + 轮询）
- [x] 快速添加栏
- [x] 移动端抽屉侧栏 / 桌面三栏（侧栏 \| 列表 \| 详情）

### P1

- [x] 标签、子任务（2 级）、检查事项、备注（Markdown 预览）
- [x] 重复规则：每天/每周/每月/自定义间隔；完成后生成下一次
- [x] 日历：月视图（react-day-picker）+ 周视图
- [x] 看板：按优先级/状态列，@dnd-kit 拖拽换列
- [x] 四象限：优先级映射，拖拽改优先级
- [x] 番茄专注：25+5，可关联任务，本地记录时长
- [x] 搜索 + 过滤器（优先级/清单/标签）
- [x] 浅色/深色主题
- [x] 已完成、垃圾桶（软删除/恢复/清空）、放弃状态

### 明确不做（P2）

习惯、倒数日、课表、协作、时间线、并列显示、微信/邮件集成、附件、AI、小组件、多主题包等。

## 目录结构

```
src/
  components/   # layout / tasks / calendar / board / matrix / pomodoro / common
  pages/        # SettingsPage
  store/        # Zustand store
  lib/          # dates / reminders / seed / cn / constants
  types/        # 共享类型
```

## 已知限制

- 提醒仅在页面打开时生效（浏览器轮询）；需用户授予通知权限。
- 子任务仅支持 2 级（父 → 子），不做更深嵌套。
- 自然语言日期依赖 chrono-node 中文规则，极口语化表达可能识别不全。
- 无云同步 / 多端账号；刷新后靠 localStorage。
- 看板「自定义状态列」简化为待办/已完成/已放弃；未做完全自由列配置。
- Markdown 为预览子集，非所见即所得编辑器。
