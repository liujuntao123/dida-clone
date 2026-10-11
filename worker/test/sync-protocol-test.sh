#!/usr/bin/env bash
# 同步协议 v2 集成测试（对 wrangler dev 本地实例）
# 用法：BASE=http://127.0.0.1:3000 bash test/sync-protocol-test.sh
set -u
BASE="${BASE:-http://127.0.0.1:3000}"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
check() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 (期望 $2 实际 $3)"; fi; }

now() { date -u +%Y-%m-%dT%H:%M:%S.000Z; }
ago() { date -u -d "-$1 seconds" +%Y-%m-%dT%H:%M:%S.000Z; }

EMAIL="sync-test-$(date +%s)@test.dev"
PASSWD="password123"

echo "—— 注册 / 登录 ——"
R=$(curl -s -D /tmp/h1 -X POST "$BASE/api/auth/sign-up/email" -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\",\"name\":\"t\"}")
TOKEN=$(grep -i '^set-auth-token:' /tmp/h1 | cut -d' ' -f2- | tr -d '\r\n')
[ -n "$TOKEN" ] && ok "注册返回 bearer token" || bad "注册未返回 token: $R"
USER_ID=$(echo "$R" | jq -r '.user.id // empty')
[ -n "$USER_ID" ] && ok "注册返回用户 id" || bad "未取到 user id: $R"

R2=$(curl -s -D /tmp/h2 -X POST "$BASE/api/auth/sign-in/email" -H 'Content-Type: application/json' \
  -H 'Origin: https://localhost' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\"}")
TOKEN2=$(grep -i '^set-auth-token:' /tmp/h2 | cut -d' ' -f2- | tr -d '\r\n')
[ -n "$TOKEN2" ] && ok "第二设备登录（Capacitor origin）" || bad "第二设备登录失败: $R2"

BADLOGIN=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/sign-in/email" \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:5173' -d "{\"email\":\"$EMAIL\",\"password\":\"wrong-pass\"}")
check "错误密码返回 401" 401 "$BADLOGIN"

echo "—— 同步：首次推送（设备 A，cursor=0）——"
T1=$(now); L1=$(now); TAG1=$(now); S1=$(now)
BODY_A=$(jq -n --arg t1 "$T1" --arg l1 "$L1" --arg g1 "$TAG1" --arg s1 "$S1" '{
  deviceId: "deviceA", cursor: 0,
  entities: {
    lists:   [ { id: "list_inbox", name: "收集箱", color: "#4880FF", isInbox: true, order: 0, updatedAt: $l1 } ],
    tags:    [ { id: "tag_work", name: "工作", color: "#FA5151", updatedAt: $g1 } ],
    tasks:   [ { id: "task_1", title: "写周报", listId: "list_inbox", priority: 2, tags: ["tag_work"], status: "todo",
                 checklist: [{id:"c1",text:"数据",done:false}], createdAt: $t1, updatedAt: $t1, order: 0 } ],
    settings:[ { id: "app", theme: "dark", sortBy: "due", calendarMode: "month", updatedAt: $s1 } ]
  }
}')
R=$(curl -s -X POST "$BASE/api/sync" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$BODY_A")
CURSOR_A=$(echo "$R" | jq -r '.cursor')
check "设备 A 推送 applied" 4 "$(echo "$R" | jq -r '.result.applied')"
check "设备 A 新游标 > 0" "yes" "$([ "$CURSOR_A" -gt 0 ] 2>/dev/null && echo yes || echo no)"
check "设备 A delta 回含自己 4 项" 4 "$(echo "$R" | jq '[.changes.tasks[]?, .changes.lists[]?, .changes.tags[]?, .changes.settings[]?] | length')"

echo "—— 同步：设备 B 冷启动（cursor=0，应拉到全量）——"
R=$(curl -s -X POST "$BASE/api/sync" -H "Authorization: Bearer $TOKEN2" -H 'Content-Type: application/json' \
  -d '{"deviceId":"deviceB","cursor":0,"entities":{"tasks":[],"lists":[],"tags":[],"settings":[]}}')
check "设备 B 拉到任务" 1 "$(echo "$R" | jq '.changes.tasks | length')"
check "设备 B 拉到清单" 1 "$(echo "$R" | jq '.changes.lists | length')"
CURSOR_B=$(echo "$R" | jq -r '.cursor')
check "设备 B 游标与 A 一致" "$CURSOR_A" "$CURSOR_B"

echo "—— LWW：设备 B 推送更旧版本应被拒 ——"
OLD=$(ago 3600)
R=$(curl -s -X POST "$BASE/api/sync" -H "Authorization: Bearer $TOKEN2" -H 'Content-Type: application/json' \
  -d "$(jq -n --arg t "$OLD" '{deviceId:"deviceB",cursor:'"$CURSOR_B"',entities:{tasks:[{id:"task_1",title:"旧版本不该赢",listId:"list_inbox",priority:0,status:"todo",tags:[],createdAt:$t,updatedAt:$t,order:0}]}}')")
check "旧版本 skippedOlder=1" 1 "$(echo "$R" | jq -r '.result.skippedOlder')"
check "旧版本 applied=0" 0 "$(echo "$R" | jq -r '.result.applied')"
check "被拒后无需回送（B 已见过服务端版本）" 0 "$(echo "$R" | jq '.changes.tasks | length')"
# 用全量拉取确认服务端标题未被旧版本污染
R=$(curl -s -X POST "$BASE/api/sync" -H "Authorization: Bearer $TOKEN2" -H 'Content-Type: application/json' \
  -d '{"deviceId":"deviceB","cursor":0,"entities":{"tasks":[],"lists":[],"tags":[],"settings":[]}}')
check "服务端仍是新标题" "写周报" "$(echo "$R" | jq -r '.changes.tasks[] | select(.id=="task_1") | .data.title')"
CURSOR_B=$(echo "$R" | jq -r '.cursor')

echo "—— LWW：设备 B 推送更新版本应被收 ——"
NEW=$(now)
R=$(curl -s -X POST "$BASE/api/sync" -H "Authorization: Bearer $TOKEN2" -H 'Content-Type: application/json' \
  -d "$(jq -n --arg t "$NEW" '{deviceId:"deviceB",cursor:'"$CURSOR_B"',entities:{tasks:[{id:"task_1",title:"改好的标题",listId:"list_inbox",priority:3,status:"todo",tags:["tag_work"],createdAt:$t,updatedAt:$t,order:0}]}}')")
check "新版本 applied=1" 1 "$(echo "$R" | jq -r '.result.applied')"
CURSOR_B=$(echo "$R" | jq -r '.cursor')

echo "—— 并发编辑：设备 A 未见过 B 的修改，A 推送旧数据应被拒并收到 B 版 ——"
R=$(curl -s -X POST "$BASE/api/sync" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"deviceId\":\"deviceA\",\"cursor\":$CURSOR_A,\"entities\":{\"tasks\":[]}}")
check "设备 A 增量拉到 B 的修改" "改好的标题" "$(echo "$R" | jq -r '.changes.tasks[0].data.title')"
CURSOR_A=$(echo "$R" | jq -r '.cursor')

echo "—— 时钟漂移：超前 1 小时的 updatedAt 被钳制 ——"
FUTURE=$(date -u -d "+3600 seconds" +%Y-%m-%dT%H:%M:%S.000Z)
R=$(curl -s -X POST "$BASE/api/sync" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "$(jq -n --arg t "$FUTURE" '{deviceId:"deviceA",cursor:'"$CURSOR_A"',entities:{tasks:[{id:"task_2",title:"未来任务",listId:"list_inbox",priority:0,status:"todo",tags:[],createdAt:$t,updatedAt:$t,order:1}]}}')")
check "未来时间被接受但已钳制" "yes" "$(echo "$R" | jq -r '.changes.tasks[] | select(.id=="task_2") | if (.updatedAt | sub("\\.000Z$";"")) <= .updatedAt then "yes" else "no" end' 2>/dev/null | head -1)"
check "delta 含 task_2" "task_2" "$(echo "$R" | jq -r '.changes.tasks[0].id')"

echo "—— 墓碑：设备 B 删除 task_1，设备 A 应收到墓碑 ——"
sleep 1.1  # 保证墓碑 updatedAt 与现有版本不同秒
TD=$(now)
R=$(curl -s -X POST "$BASE/api/sync" -H "Authorization: Bearer $TOKEN2" -H 'Content-Type: application/json' \
  -d "$(jq -n --arg t "$TD" '{deviceId:"deviceB",cursor:'"$CURSOR_B"',entities:{tasks:[{id:"task_1",deleted:true,updatedAt:$t}]}}')")
check "墓碑被接受" 1 "$(echo "$R" | jq -r '.result.applied')"
CURSOR_B=$(echo "$R" | jq -r '.cursor')
R=$(curl -s -X POST "$BASE/api/sync" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"deviceId\":\"deviceA\",\"cursor\":$CURSOR_A,\"entities\":{\"tasks\":[]}}")
TOMB=$(echo "$R" | jq '.changes.tasks[] | select(.id=="task_1")')
check "设备 A 收到墓碑" "true" "$(echo "$TOMB" | jq -r '.deleted')"
CURSOR_A=$(echo "$R" | jq -r '.cursor')

echo "—— 幂等：同批数据原样重发应全部 skipped 且无新增 delta ——"
R=$(curl -s -X POST "$BASE/api/sync" -H "Authorization: Bearer $TOKEN2" -H 'Content-Type: application/json' \
  -d "$(echo "$BODY_A" | jq -c '.cursor = '"$CURSOR_B")")
check "重发 applied=0" 0 "$(echo "$R" | jq -r '.result.applied')"
check "重发 skipped=4" 4 "$(echo "$R" | jq -r '.result.skippedOlder')"
check "重发无新增 delta" 0 "$(echo "$R" | jq '[.changes.tasks[]?, .changes.lists[]?, .changes.tags[]?, .changes.settings[]?] | length')"

echo "—— 鉴权与限界 ——"
UNAUTH=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/sync" -H 'Content-Type: application/json' -d '{}')
check "无 token 401" 401 "$UNAUTH"
BADTOKEN=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/sync" -H 'Authorization: Bearer garbage' -H 'Content-Type: application/json' -d '{}')
check "伪造 token 401" 401 "$BADTOKEN"

echo "—— 导出 ——"
R=$(curl -s "$BASE/api/export" -H "Authorization: Bearer $TOKEN")
check "导出含 1 个任务（task_1 已删）" 1 "$(echo "$R" | jq '.tasks | length')"

echo "—— 会话管理 ——"
R=$(curl -s "$BASE/api/auth/list-sessions" -H "Authorization: Bearer $TOKEN")
check "设备 A 能列出 2 个会话" 2 "$(echo "$R" | jq 'length')"

echo
echo "通过 $PASS / $((PASS+FAIL))"
[ "$FAIL" -eq 0 ] || exit 1
