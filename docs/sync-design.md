# 云同步一致性设计（v2）

> 适用版本：v0.12.0+。旧版「整包 JSON + revision 乐观锁 + Access Key」方案已完全移除。

## 0. 总览

```
┌──────────┐   POST /api/sync (Bearer)   ┌────────────────┐
│ 客户端    │ ──全量本地实体 + cursor────▶ │ Cloudflare Worker │
│ Zustand  │                             │  better-auth 会话 │
│ localStorage                            │  LWW 裁决 (batch) │
└──────────┘ ◀── seq>cursor 增量 + 新 cursor ┴───────┬────────┘
                                                    ▼
                                          D1: entity / data_seq
                                              sync_log / audit_log
```

数据模型：`(user_id, type, id)` 唯一的**实体表**，`type ∈ {task, list, tag, settings}`；
删除是**墓碑**（`deleted=1`，只留 id/updatedAt）；偏好（主题/排序/日历模式）是 id 固定为
`app` 的 settings 实体。`notifiedReminders`、当前视图、过滤器等属于**设备本地状态**，不同步。

## 1. 核心机制

### 1.1 状态基同步（State-based）而非操作基（Op-based）

客户端每次上送**全量本地实体**（而非增量操作日志）。选择理由：

- **天然幂等**：请求丢失、应用被杀、重复发送都无害——下轮全量重发即可；
- 无需维护「待同步队列」：任何时刻本地状态就是完整的待同步集合；
- 个人规模（数千任务 ≈ 数百 KB，gzip 后更小）下带宽可接受；
- 服务端无状态补齐逻辑：一请求内完成「裁决 + 增量回送」。

### 1.2 实体级 LWW（Last-Writer-Wins）

每个实体带客户端逻辑时间 `updatedAt` 与设备标识 `deviceId`，裁决键为
**`(updatedAt, deviceId)` 字典序**，键大者胜：

- 服务端接收时与现值比较，键大则覆盖（分配新 seq），否则跳过（`skippedOlder`）；
- **精确并列**（同 updatedAt 同 deviceId）且「删除 vs 存活」冲突时，**删除胜**（确定性收敛）；
- updatedAt 超前服务器时钟 2 分钟以上会被**钳制**到 `serverNow + 2min`
  （防时钟漂移的设备永久霸占裁决键；钳制后的压制窗口上限即 2 分钟，自愈）；
- 客户端应用服务端版本时用**同一把尺子**：`server.updatedAt >= local.updatedAt` 即采纳
  （并列采用服务端是安全的——服务端已用完整键裁决过，双端必然收敛）。

**语义边界（有意为之）**：实体级 LWW 意味着「离线编辑了别端已删除的任务 → 更新的编辑复活该任务」。
任务、子任务天然是独立实体；检查项（checklist）随宿主任务走 LWW——两端并发改同一条任务的
不同字段时，整条任务以较新一方为准。这是简洁性与合并粒度的折衷，滴答清单本体也是实体级版本。

### 1.3 单调游标（seq）增量拉取

- 服务端为每用户维护 `data_seq` 单调计数器；一次同步中**被接受的实体**获得连续区间
  `[max-k+1, max]` 的 seq（`UPDATE … RETURNING` 原子分配，并发请求由 D1 单写者串行化，不丢号）；
- 响应回送 `seq > cursor` 的全部行 + 新 cursor（`max(分配上限, 增量最大 seq)`，且**不超前**
  服务端当前计数——服务器库重置时自动收敛）；
- 客户端丢 cursor（清存储/换设备）→ 从 0 全量重拉 → LWW 合并，**自愈无损**。

### 1.4 墓碑

本地删除（彻底删除任务 / 清空回收站 / 删清单 / 删标签）在客户端记录
`pendingTombstones[type:id] = 删除时刻`，随每次同步以墓碑实体上送：

- 服务端落库为 `deleted=1` 行，**长期保留**（个人规模无压力；管理员可在后台清理，见 §4）；
- 被服务端 delta 回送确认后从 pending 清单移除；30 天未确认的放弃重发（防膨胀）；
- 墓碑 vs 旧编辑 → 墓碑胜；墓碑 vs 更新的编辑 → 编辑胜（复活，见 §1.2）。

### 1.5 首次同步（init）两阶段

新设备登录后：

1. **探查**：以 `cursor=0` 空 entities 上送，只拉不推；
2. 服务端**非空** → **整体采用**（wholesale adopt）云端全量，丢弃本地种子数据
   ——绝不参与 LWW：种子的 updatedAt 是「现在」，会让种子反噬云端真实数据；
3. 服务端**为空**（新账号）→ 立即补一轮把本地（种子）推上去，成为云端初始数据。

种子数据的 id 是确定性常量（`list-work`、`task-1`…），两台设备同时初始化同一空账号时
LWW 按 id 折叠，不会翻倍。

### 1.6 客户端引擎（`src/lib/cloudSync.ts`）

- **单飞（single-flight）**：同步串行执行；期间的新改动合并为结束后的一轮补跑；
- **防抖**：本地改动后 1.5s 合并上送；应用服务端变更期间抑制回推 + 结构化等值检查
  （无实际变化不写 store），杜绝同步风暴；
- **退避重试**：离线/失败按 5s→15s→30s→60s 重试；`online` 事件与 `visibilitychange`
  立即触发；另有 60s 周期兜底；
- **请求超时** 20s（AbortController）；
- **401** → 清令牌回登录页（本地缓存保留；同账号重登录无缝续传，异账号登录自动重置）。

## 2. 网络与边界场景对照表

| 场景 | 行为 | 保证 |
|------|------|------|
| 请求超时 / 断网 | 状态置 offline，指数退避重试 | 无损（状态基幂等） |
| 同步期间本地编辑 | 本轮照常，结束后自动补一轮 | 不丢 |
| 应用被杀（同步中途） | 下轮全量重发 | 无损 |
| 双端并发改同一实体 | LWW 裁决，双端收敛到同一版本 | 最终一致 |
| 双端并发改不同实体 | 各自被接受，delta 互换 | 都不丢 |
| 离线删除 vs 对端编辑 | 键大者胜（删除胜并列） | 确定性 |
| 时钟漂移（超前 >2min） | 服务端钳制 | 漂移设备最多压制 2min |
| 服务器时钟回拨 | seq 单调由计数器保证，与墙钟无关 | 增量流不乱 |
| 换设备登录 | init 两阶段整体采用 | 种子不反噬 |
| 服务器库重置 / cursor 失效 | cursor 钳制 + 从 0 全量重拉 | 自愈 |
| 清空本地存储后登录 | init 重新整体采用 | 自愈 |
| 多标签页同设备 | 同 deviceId，LWW 等键跳过 | 幂等 |
| 注册即初始化竞态（双端同时初始化空账号） | 种子常量 id 折叠 | 不翻倍 |

## 3. 认证与多端

- **better-auth**（Bearer 令牌模式）：邮箱 + 密码注册/登录；令牌由 `set-auth-token`
  响应头下发，存 localStorage，所有 API 以 `Authorization: Bearer` 携带——天然适配
  Web / Capacitor 安卓壳 / curl，避免跨源 Cookie 的复杂度；
- 会话 30 天滑动续期；密码修改可使其他设备全部失效；设置页可查看/远程注销设备；
- **口令哈希用 PBKDF2-SHA256 100k（WebCrypto）**而非默认 scrypt：Cloudflare Workers
  免费版 10ms CPU/请求限额扛不住 scrypt（实测注册/校验请求被杀），PBKDF2 原生执行可稳定通过；
  存储格式 `pbkdf2$iterations$salt_b64url$hash_b64url`；
- 封禁用户即时失效其全部会话；注销账号在服务端清空实体/日志/会话/用户（审计留痕抹去 user_id）；
- 登出（本地）：撤销服务端会话 + 本地数据回种子态 + 停同步引擎。

## 4. 后台管理（admin/）

独立 SPA（浅色 SaaS 风格），部署时以静态资产挂在同一 Worker 的 `/admin` 路径：

- **总览**：用户/任务/会话/同步量指标 + 近 7 天同步柱状图 + 最近同步流水；
- **用户**：搜索、封禁（better-auth admin 端点）、解封、删除（含云端数据）；
- **日志**：同步流水（每请求一行：推送/接受/跳过/拉取/耗时/游标，保留 90 天，自动滚动清理）
  + 审计（注册/登录/登出/改密/管理操作/注销）；
- **维护**：清理超期墓碑（默认保留 90 天；清理前须确认所有设备近 90 天内活跃过，
  否则长期离线设备可能复活已被清理的删除）。

管理员由 `ADMIN_EMAIL` secret 指定：该邮箱注册即 `role=admin`；
`DISABLE_SIGNUPS=true` 可关闭开放注册。

## 5. 部署与运维

```bash
cd worker
npx wrangler d1 execute dida-clone-db --remote --file=schema.sql   # 建表（一次）
npx wrangler secret put BETTER_AUTH_SECRET                          # 强随机串
npx wrangler secret put ADMIN_EMAIL                                 # 管理员邮箱
npm run deploy     # = 构建 admin SPA → 拷入 public/admin → wrangler deploy
```

前端默认连内置的线上地址（构建时 `VITE_API_BASE_URL` 可覆盖）；自托管者可在
登录页「高级选项」或设置页填写自己的 Worker 地址。

## 6. 已知限制

- LWW 粒度为实体级：并发编辑同一条任务的不同字段时整条以新者为准（不做字段级合并）；
- 墓碑永久保留（除手动清理）；清理前须确认所有设备在保留期内活跃；
- 提醒已读状态（notifiedReminders）是设备本地状态，不跨端同步；
- rate limit 使用 better-auth 默认的每 isolate 内存存储，多 isolate 下限流为近似值。
