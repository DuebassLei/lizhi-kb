# CC 工作台 · Node / ai-bridge 进程管理（精简版）

**文档版本**：v1.0.0  
**更新日期**：2026-07-14  
**状态**：已实现  
**对齐**：jetbrains-cc-gui「Node 进程管理」能力的精简子集（方案 A2）  
**关联**：[2026-07-10-cc-workbench-design.md](./2026-07-10-cc-workbench-design.md)（§17 按需对齐）

---

## 1. 背景与目标

CC GUI 在 Agent 菜单提供「Node 进程管理」：展示守护/孤立进程、PID、运行时长，支持刷新与终止。狸知 Agent 工作台目前仅有会话 abort 时对 `ACTIVE_BRIDGE_PID` 的进程树终止，**无列表 UI**，也**无法发现登记丢失后仍存活的 bridge**。

**目标（精简版 A2）**：

1. 登记狸知 spawn 的 `ai-bridge/channel-manager.js` 进程（会话流 / enhance / modelTest）  
2. 打开面板或刷新时，按命令行指纹扫描本机，发现不在登记表中的**孤立** bridge  
3. 顶栏入口展示进程数；支持刷新与终止（「重启」语义见 §5）  

**明确不做**：

- 常驻 Daemon 进程模型与自动保活  
- 扫描/终止非狸知 cmdline 的任意 Node  
- 终止后自动重发用户消息  
- 浏览器预览模式下的真实进程（列表为空即可）  
- OAuth / 捆绑 Node 等 §17.3 刻意不做项  

---

## 2. 方案选型

| 方案 | 做法 | 结论 |
|------|------|------|
| A1 仅内存登记 | 扩展 `ACTIVE_BRIDGE_PID` 为多条目登记 | 改动小，但崩溃/丢登记后看不到残留 |
| **A2 登记 + 孤立扫描（采用）** | 登记表 + cmdline 指纹轻量扫描 | ✅ 能清理异常残留，仍限定狸知 bridge |
| A3 仅设置页 | 能力同 A1/A2，入口埋在 SDK 设置 | 卡死时不够顺手 |

---

## 3. 进程模型

### 3.1 条目字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `pid` | `u32` | 进程 ID |
| `kind` | `session` \| `enhance` \| `modelTest` | 启动用途；孤立扫描若无法区分则默认 `session` |
| `role` | `tracked` \| `orphan` | 是否在当前登记表内 |
| `startedAtMs` | `u64 \| null` | 登记时的 Unix ms；孤立可为 null |
| `commandHint` | `string` | 可选，截断后的 cmdline 便于排查 |

### 3.2 登记生命周期

| 事件 | 行为 |
|------|------|
| spawn `claude send` | 登记 `kind=session`，写入 `ACTIVE_BRIDGE_*` 兼容字段（stdin / 权限等待仍绑定当前 session） |
| spawn `enhance` / `test-model` | 登记对应 kind；sidecar 结束后从登记表移除（不必占用 session stdin 槽） |
| 正常退出 / wait 结束 | 移除该 PID |
| `cc_workbench_abort` | 终止当前 session 树并清登记；与「终止该 session PID」行为对齐 |
| `kill_cc_bridge_process(pid)` | 校验归属后 `kill_process_tree`；若 pid 为当前 session 则走与 abort 相同的清理 |

**会话并发约束（保持现状）**：同一时刻仅一个 `session` stream（现有 `ACTIVE_BRIDGE_PID` 语义）；enhance / modelTest 可短暂并存于登记表。

### 3.3 孤立判定

扫描条件（需同时满足）：

1. 进程可执行文件为 `node` / `node.exe`（或 cmdline 首参为 node）  
2. cmdline 包含已解析的 bridge 脚本路径片段：`channel-manager.js`，且与狸知 `resolve_bridge_script()` 路径一致或为其文件名 + 父路径可识别为 ai-bridge 资源/packages 路径  
3. 该 `pid` **不在**当前登记表  

满足 → `role=orphan`。不匹配上述指纹的 Node **一律忽略**。

平台实现提示：

- Windows：`wmic process get ProcessId,CommandLine` 或等效只读 API；过滤即可  
- Unix：`ps -ax -o pid=,command=` 或读 `/proc/*/cmdline`  

扫描失败时：仅返回登记表条目，`orphanCount=0`，UI 可静默（不阻断终止 tracked）。

---

## 4. IPC 与前端 API

### 4.1 Rust / Tauri commands

```
list_cc_bridge_processes() -> CcBridgeProcessList
kill_cc_bridge_process(pid: u32) -> ()
```

```rust
struct CcBridgeProcessEntry {
    pid: u32,
    kind: String,           // session | enhance | modelTest
    role: String,           // tracked | orphan
    started_at_ms: Option<u64>,
    command_hint: Option<String>,
}

struct CcBridgeProcessList {
    processes: Vec<CcBridgeProcessEntry>,
    tracked_count: usize,
    orphan_count: usize,
}
```

`kill_cc_bridge_process`：

1. 若 pid 在登记表 → 按 kind 清理；session 时复用 `abort_active_stream` 清理路径  
2. 若仅扫描为 orphan 且指纹匹配 → `kill_process_tree`  
3. 否则返回错误：「进程不属于狸知 ai-bridge」  

现有 `cc_workbench_abort` **保留**，内部改为调用同一套登记/终止逻辑，避免双路径分叉。

### 4.2 `ccWorkbenchService.ts`

```ts
listCcBridgeProcesses(): Promise<CcBridgeProcessList>
killCcBridgeProcess(pid: number): Promise<void>
```

非 Tauri：返回空列表 / no-op。

---

## 5. UI

### 5.1 入口

- 组件：`CcBridgeProcessMenu.vue`  
- 挂载：`CcWorkbenchShell` 顶栏，**设置按钮左侧**  
- 文案：`Node 进程`；角标/后缀显示总数 `N`（`tracked + orphan`）  
- `data-testid`：`cc-bridge-process-menu`

### 5.2 Popover 内容

- 标题行：`共 N 个 · 孤立 M 个` + 刷新按钮  
- 分组：`进行中 (tracked)` / `孤立 (orphan)`  
- 行：显示名（如「会话桥接」「提示词增强」「模型探测」）、`PID xxx`、时长（有 `startedAtMs` 则本地计时，否则「—」）、终止按钮  
- **重启**：精简版 = 终止该 PID + 若为当前 session 则清前端 streaming（不自动重发）；UI 可用「终止」为主按钮，可选「停止并清理」文案，避免承诺「重启服务」  
- 空态：`当前无 ai-bridge 进程`  
- 打开入口或点击刷新 → 调用 `listCcBridgeProcesses`

### 5.3 与「停止生成」关系

输入框停止按钮继续调用 `abortCcWorkbenchStream`；进程面板终止当前 session PID 效果相同。二者共用 Rust 清理逻辑。

---

## 6. 实现切片

1. **Rust**：登记表结构、spawn/exit 挂钩、`list`（登记 + 扫描）、`kill`、abort 复用  
2. **Service**：TS 类型与 invoke 封装  
3. **UI**：`CcBridgeProcessMenu` + Shell 挂载；打开时拉取、终止后刷新  
4. **文档**：本文件状态 → 已实现；工作台 spec §17.4 / §14 勾选；必要时 `AGENTS.md` 一句索引  

**验证**：

- `pnpm verify:fe`  
- Tauri/IPC：`cargo check`  
- 冒烟：`pnpm tauri dev` → 发消息见 tracked=1 → 面板终止 → 人为残留（若可构造）扫为 orphan 并清掉  

无需改 `packages/ai-bridge` 脚本时，可不跑 sync-ai-bridge。

---

## 7. 验收标准

- [x] 对话流式进行中，顶栏显示至少 1 个进程，面板可见 PID（Tauri 冒烟待人工确认）  
- [x] 终止 panel 中 session 进程后，流式停止且登记清空（实现：`kill` + `cc.stop()`）  
- [x] 输入框「停止」与 panel 终止行为一致、无僵死 stdin/权限等待（共用 `clear_session_runtime_state` / abort）  
- [x] 孤立指纹匹配的残留 bridge 可被列出并安全终止（cmdline 扫描 + kill 校验）  
- [x] 非狸知 Node 进程不会出现在列表中（指纹单测覆盖）  
- [x] 浏览器预览：入口可见、列表为空、无报错（非 Tauri 返回空列表）  

---

## 8. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-07-14 | 初稿：A2 登记 + 孤立扫描；顶栏入口；kill/abort 统一 |
| v1.0.1 | 2026-07-14 | 已实现：`bridge_processes` + 顶栏 `CcBridgeProcessMenu` |
