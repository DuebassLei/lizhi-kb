# CC Bridge Process Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Agent 工作台顶栏提供「Node 进程」面板：登记 + 孤立扫描狸知 `ai-bridge` 进程，支持刷新与安全终止。

**Architecture:** 新建 `cc_workbench/bridge_processes.rs` 维护进程登记表与 cmdline 指纹扫描；`runtime.rs` 在 spawn/exit/abort 时挂钩；新增 Tauri `list_cc_bridge_processes` / `kill_cc_bridge_process`；Vue `CcBridgeProcessMenu` 挂在 `CcWorkbenchShell` 设置按钮左侧。

**Tech Stack:** Rust (Tauri 2) · Vue 3 + TypeScript · 现有 `ccWorkbenchService` / `hidden_command`

**Spec:** [docs/superpowers/specs/2026-07-14-cc-bridge-process-manager-design.md](../specs/2026-07-14-cc-bridge-process-manager-design.md)

**Commit 策略：** 本仓库默认不主动 commit；下列 Commit 步骤仅在用户明确要求提交时执行。

---

## File map

| File | Responsibility |
|------|----------------|
| **Create** `src-tauri/src/cc_workbench/bridge_processes.rs` | 登记表、指纹匹配、OS 扫描、list/kill API、单元测试 |
| Modify `src-tauri/src/cc_workbench/mod.rs` | `pub mod bridge_processes` + re-export 类型 |
| Modify `src-tauri/src/cc_workbench/types.rs` | （可选）不强制；列表类型放在 `bridge_processes.rs` 即可 |
| Modify `src-tauri/src/cc_workbench/runtime.rs` | spawn/exit/abort 挂钩登记表；abort 统一走 kill 清理 |
| Modify `src-tauri/src/commands.rs` | 注册两个 command |
| Modify `src-tauri/src/lib.rs` | `generate_handler!` 注册 |
| Modify `src/services/ccWorkbenchService.ts` | TS 类型 + `listCcBridgeProcesses` / `killCcBridgeProcess` |
| **Create** `src/components/cc/chat/CcBridgeProcessMenu.vue` | 顶栏入口 + popover |
| Modify `src/components/cc/CcWorkbenchShell.vue` | 挂载菜单（设置按钮左侧） |
| Modify specs（Task 6） | 状态勾选与 §17.4 |

---

### Task 1: `bridge_processes` 模块 + 指纹/登记单测

**Files:**
- Create: `src-tauri/src/cc_workbench/bridge_processes.rs`
- Modify: `src-tauri/src/cc_workbench/mod.rs`

- [ ] **Step 1: 添加模块骨架与类型**

在 `mod.rs` 的 `pub mod` 列表中加入 `bridge_processes`，并 export：

```rust
pub use bridge_processes::{
    CcBridgeProcessEntry, CcBridgeProcessList, kill_bridge_process, list_bridge_processes,
};
```

创建 `bridge_processes.rs`：

```rust
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use super::paths::resolve_bridge_script;
use super::process_utils::hidden_command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcBridgeProcessEntry {
    pub pid: u32,
    pub kind: String,
    pub role: String,
    pub started_at_ms: Option<u64>,
    pub command_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcBridgeProcessList {
    pub processes: Vec<CcBridgeProcessEntry>,
    pub tracked_count: usize,
    pub orphan_count: usize,
}

#[derive(Debug, Clone)]
struct TrackedBridge {
    kind: String,
    started_at_ms: u64,
    is_session: bool,
}

static TRACKED: Mutex<HashMap<u32, TrackedBridge>> = Mutex::new(HashMap::new());

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn track_bridge(pid: u32, kind: &str) {
    let is_session = kind == "session";
    if let Ok(mut map) = TRACKED.lock() {
        if is_session {
            map.retain(|_, v| !v.is_session);
        }
        map.insert(
            pid,
            TrackedBridge {
                kind: kind.to_string(),
                started_at_ms: now_ms(),
                is_session,
            },
        );
    }
}

pub fn untrack_bridge(pid: u32) {
    if let Ok(mut map) = TRACKED.lock() {
        map.remove(&pid);
    }
}

pub fn untrack_session() {
    if let Ok(mut map) = TRACKED.lock() {
        map.retain(|_, v| !v.is_session);
    }
}

pub fn session_pid() -> Option<u32> {
    TRACKED.lock().ok().and_then(|map| {
        map.iter()
            .find(|(_, v)| v.is_session)
            .map(|(pid, _)| *pid)
    })
}

/// Pure helper for tests + orphan filter.
pub fn is_lizhi_bridge_cmdline(cmdline: &str, bridge_path_hint: &str) -> bool {
    let lower = cmdline.to_lowercase();
    if !lower.contains("node") {
        return false;
    }
    if !lower.contains("channel-manager.js") {
        return false;
    }
    let hint = bridge_path_hint.replace('\\', "/").to_lowercase();
    let norm = lower.replace('\\', "/");
    if !hint.is_empty() && norm.contains(&hint) {
        return true;
    }
    norm.contains("ai-bridge/channel-manager.js")
        || norm.contains("ai-bridge\\channel-manager.js".replace('\\', "/"))
}
```

- [ ] **Step 2: 写失败/通过单测（纯函数）**

同文件末尾：

```rust
#[cfg(test)]
mod tests {
    use super::is_lizhi_bridge_cmdline;

    #[test]
    fn matches_resolved_bridge_path() {
        let hint = r"D:\codes\lizhi-kb\packages\ai-bridge\channel-manager.js";
        let cmd = r#"node.exe D:\codes\lizhi-kb\packages\ai-bridge\channel-manager.js claude send"#;
        assert!(is_lizhi_bridge_cmdline(cmd, hint));
    }

    #[test]
    fn rejects_unrelated_node() {
        let hint = r"/home/u/.lizhi-kb/x/channel-manager.js";
        assert!(!is_lizhi_bridge_cmdline("node /tmp/other-app/server.js", hint));
        assert!(!is_lizhi_bridge_cmdline("python channel-manager.js", hint));
    }

    #[test]
    fn matches_ai_bridge_path_segment() {
        let cmd = "node /app/resources/ai-bridge/channel-manager.js claude enhance";
        assert!(is_lizhi_bridge_cmdline(cmd, ""));
    }
}
```

- [ ] **Step 3: 跑测**

```bash
cd src-tauri && cargo test is_lizhi_bridge_cmdline -- --nocapture
```

Expected: 3 passed

- [ ] **Step 4: Commit（仅用户要求时）**

```bash
git add src-tauri/src/cc_workbench/bridge_processes.rs src-tauri/src/cc_workbench/mod.rs
git commit -m "feat(cc): add bridge process registry and cmdline fingerprint"
```

---

### Task 2: 扫描、list、kill + runtime 挂钩

**Files:**
- Modify: `src-tauri/src/cc_workbench/bridge_processes.rs`
- Modify: `src-tauri/src/cc_workbench/runtime.rs`

- [ ] **Step 1: 实现 OS 扫描与 `list_bridge_processes`**

在 `bridge_processes.rs` 追加（Windows 用 `wmic`；非 Windows 用 `/proc` 或 `ps`）：

```rust
fn bridge_path_hint() -> String {
    resolve_bridge_script()
        .unwrap_or_default()
        .replace('\\', "/")
        .to_lowercase()
}

fn scan_node_cmdlines() -> Vec<(u32, String)> {
    #[cfg(windows)]
    {
        let output = match hidden_command("wmic")
            .args(["process", "where", "name='node.exe'", "get", "ProcessId,CommandLine", "/FORMAT:CSV"])
            .output()
        {
            Ok(o) if o.status.success() => o,
            _ => return Vec::new(),
        };
        let text = String::from_utf8_lossy(&output.stdout);
        let mut rows = Vec::new();
        for line in text.lines().skip(1) {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            // CSV: Node,CommandLine,ProcessId
            let mut parts = line.rsplitn(2, ',');
            let pid_s = parts.next().unwrap_or("").trim();
            let rest = parts.next().unwrap_or("").trim();
            // rest may still contain Node,CommandLine — take after first comma
            let cmdline = rest.split_once(',').map(|(_, c)| c).unwrap_or(rest);
            if let Ok(pid) = pid_s.parse::<u32>() {
                if !cmdline.is_empty() {
                    rows.push((pid, cmdline.to_string()));
                }
            }
        }
        rows
    }
    #[cfg(not(windows))]
    {
        let mut rows = Vec::new();
        let Ok(entries) = std::fs::read_dir("/proc") else {
            return rows;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let pid_s = name.to_string_lossy();
            let Ok(pid) = pid_s.parse::<u32>() else {
                continue;
            };
            let cmdline_path = entry.path().join("cmdline");
            let Ok(bytes) = std::fs::read(cmdline_path) else {
                continue;
            };
            let cmdline = bytes
                .split(|b| *b == 0)
                .filter(|s| !s.is_empty())
                .map(|s| String::from_utf8_lossy(s).into_owned())
                .collect::<Vec<_>>()
                .join(" ");
            if cmdline.to_lowercase().contains("node") {
                rows.push((pid, cmdline));
            }
        }
        rows
    }
}

pub fn list_bridge_processes() -> CcBridgeProcessList {
    let hint = bridge_path_hint();
    let tracked_snapshot: Vec<(u32, TrackedBridge)> = TRACKED
        .lock()
        .ok()
        .map(|map| map.iter().map(|(k, v)| (*k, v.clone())).collect())
        .unwrap_or_default();

    let mut processes = Vec::new();
    let mut tracked_pids = std::collections::HashSet::new();

    for (pid, t) in &tracked_snapshot {
        tracked_pids.insert(*pid);
        processes.push(CcBridgeProcessEntry {
            pid: *pid,
            kind: t.kind.clone(),
            role: "tracked".into(),
            started_at_ms: Some(t.started_at_ms),
            command_hint: None,
        });
    }

    for (pid, cmdline) in scan_node_cmdlines() {
        if tracked_pids.contains(&pid) {
            continue;
        }
        if !is_lizhi_bridge_cmdline(&cmdline, &hint) {
            continue;
        }
        let hint_short = if cmdline.len() > 160 {
            format!("{}…", &cmdline[..160])
        } else {
            cmdline
        };
        processes.push(CcBridgeProcessEntry {
            pid,
            kind: "session".into(),
            role: "orphan".into(),
            started_at_ms: None,
            command_hint: Some(hint_short),
        });
    }

    let tracked_count = processes.iter().filter(|p| p.role == "tracked").count();
    let orphan_count = processes.iter().filter(|p| p.role == "orphan").count();
    CcBridgeProcessList {
        processes,
        tracked_count,
        orphan_count,
    }
}
```

- [ ] **Step 2: 实现 `kill_bridge_process`（与 abort 共享 kill 树）**

将 `runtime.rs` 中的 `kill_process_tree` 改为 `pub(crate)`，或抽到 `bridge_processes` / `process_utils` 后双方调用。推荐：把 `kill_process_tree` 移到 `process_utils.rs` 为 `pub fn kill_process_tree(pid: u32) -> Result<(), String>`（内容即现有 Win `taskkill /T /F` / Unix `kill`）。

```rust
// bridge_processes.rs
use super::process_utils::kill_process_tree;

pub fn kill_bridge_process(pid: u32) -> Result<(), String> {
    let in_tracked = TRACKED
        .lock()
        .ok()
        .and_then(|map| map.get(&pid).cloned());
    if let Some(t) = in_tracked {
        kill_process_tree(pid)?;
        untrack_bridge(pid);
        if t.is_session {
            // runtime 侧清 stdin / permission；见 Step 3 的 clear_session_runtime_state
            crate::cc_workbench::runtime::clear_session_runtime_state();
        }
        return Ok(());
    }

    let hint = bridge_path_hint();
    let orphan_ok = scan_node_cmdlines()
        .into_iter()
        .any(|(p, cmd)| p == pid && is_lizhi_bridge_cmdline(&cmd, &hint));
    if !orphan_ok {
        return Err("进程不属于狸知 ai-bridge".into());
    }
    kill_process_tree(pid)?;
    Ok(())
}
```

注意避免 `bridge_processes` ↔ `runtime` 循环依赖：优先让 `kill_bridge_process` **不**直接调 `runtime`；改为：

- `kill_bridge_process` 只负责杀进程 + untrack  
- `runtime::abort_active_stream` / command 层在 kill session 后调 `clear_bridge_child` 已有逻辑  
- 或把 stdin/permission 清理提成 `runtime::clear_session_runtime_state()`，由 `commands::kill_cc_bridge_process` 编排：

```rust
pub fn kill_cc_bridge_process(pid: u32) -> Result<(), String> {
    let was_session = crate::cc_workbench::bridge_processes::session_pid() == Some(pid);
    crate::cc_workbench::bridge_processes::kill_bridge_process(pid)?;
    if was_session {
        crate::cc_workbench::runtime::clear_session_runtime_state();
    }
    Ok(())
}
```

此时 `kill_bridge_process` 内勿再 `use runtime`。

- [ ] **Step 3: 挂钩 `runtime.rs`**

1. 抽出 `pub(crate) fn clear_session_runtime_state()`：内容为现有 `clear_bridge_child()`（清 `ACTIVE_BRIDGE_PID`、stdin、permission waiters）。  
2. `track_bridge_child` 改为同时：

```rust
fn track_bridge_child(child: &std::process::Child, kind: &str) {
    let pid = child.id();
    if let Ok(mut guard) = ACTIVE_BRIDGE_PID.lock() {
        *guard = Some(pid);
    }
    super::bridge_processes::track_bridge(pid, kind);
}
```

会话 spawn（`claude send`）调用 `track_bridge_child(&child, "session")`。  
3. Sidecar `run_bridge_sidecar_timed`：spawn 后 `track_bridge(pid, "enhance"|"modelTest")`，`wait`/超时结束后 `untrack_bridge(pid)`（enhance vs test-model 由 `subcommand` 映射：`enhance`→`enhance`，`test-model`→`modelTest`）。  
4. `clear_bridge_child` / abort：`untrack_session()` + 原清理。  
5. `abort_active_stream`：仍 kill `ACTIVE_BRIDGE_PID`（或 `session_pid()`），并 `untrack_session` + `clear_session_runtime_state`。

- [ ] **Step 4: 编译检查**

```bash
cd src-tauri && cargo check
```

Expected: 无 error

- [ ] **Step 5: Commit（仅用户要求时）**

```bash
git add src-tauri/src/cc_workbench/bridge_processes.rs src-tauri/src/cc_workbench/runtime.rs src-tauri/src/cc_workbench/process_utils.rs
git commit -m "feat(cc): list/kill ai-bridge processes with orphan scan"
```

---

### Task 3: Tauri commands 注册

**Files:**
- Modify: `src-tauri/src/commands.rs`（在 `cc_workbench_abort` 附近）
- Modify: `src-tauri/src/lib.rs`（`generate_handler!`）

- [ ] **Step 1: 添加 commands**

```rust
#[tauri::command]
pub fn list_cc_bridge_processes() -> Result<crate::cc_workbench::CcBridgeProcessList, String> {
    Ok(crate::cc_workbench::list_bridge_processes())
}

#[tauri::command]
pub fn kill_cc_bridge_process(pid: u32) -> Result<(), String> {
    let was_session = crate::cc_workbench::bridge_processes::session_pid() == Some(pid);
    crate::cc_workbench::bridge_processes::kill_bridge_process(pid)?;
    if was_session {
        crate::cc_workbench::runtime::clear_session_runtime_state();
    }
    Ok(())
}
```

保持：

```rust
#[tauri::command]
pub fn cc_workbench_abort() -> Result<(), String> {
    crate::cc_workbench::runtime::abort_active_stream()
}
```

- [ ] **Step 2: 注册 handler**

在 `lib.rs` 中紧挨 `cc_workbench_abort`：

```rust
commands::list_cc_bridge_processes,
commands::kill_cc_bridge_process,
```

- [ ] **Step 3: `cargo check`**

```bash
cd src-tauri && cargo check
```

Expected: ok

---

### Task 4: 前端 Service

**Files:**
- Modify: `src/services/ccWorkbenchService.ts`

- [ ] **Step 1: 增加类型与 API**

靠近 `CcWorkbenchStatus` 定义处追加：

```ts
export interface CcBridgeProcessEntry {
  pid: number;
  kind: "session" | "enhance" | "modelTest" | string;
  role: "tracked" | "orphan" | string;
  startedAtMs: number | null;
  commandHint?: string | null;
}

export interface CcBridgeProcessList {
  processes: CcBridgeProcessEntry[];
  trackedCount: number;
  orphanCount: number;
}

export async function listCcBridgeProcesses(): Promise<CcBridgeProcessList> {
  if (!isTauriRuntime()) {
    return { processes: [], trackedCount: 0, orphanCount: 0 };
  }
  return tauriInvoke<CcBridgeProcessList>("list_cc_bridge_processes");
}

export async function killCcBridgeProcess(pid: number): Promise<void> {
  if (!isTauriRuntime()) return;
  await tauriInvoke<void>("kill_cc_bridge_process", { pid });
}
```

- [ ] **Step 2: 类型检查**

```bash
pnpm exec vue-tsc --noEmit
```

或项目等价：`pnpm verify:fe`（Task 6 再跑全量亦可）。本步至少保证新导出无 TS 错误。

---

### Task 5: `CcBridgeProcessMenu` + Shell 挂载

**Files:**
- Create: `src/components/cc/chat/CcBridgeProcessMenu.vue`
- Modify: `src/components/cc/CcWorkbenchShell.vue`

- [ ] **Step 1: 实现菜单组件**

参考 `CcStatusPanelBar` 的相对定位 popover；结构要点：

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Cpu, RefreshCw, X } from "@lucide/vue";
import {
  killCcBridgeProcess,
  listCcBridgeProcesses,
  type CcBridgeProcessEntry,
  type CcBridgeProcessList,
} from "../../../services/ccWorkbenchService";

const open = ref(false);
const loading = ref(false);
const list = ref<CcBridgeProcessList>({
  processes: [],
  trackedCount: 0,
  orphanCount: 0,
});
const now = ref(Date.now());
let tickTimer: ReturnType<typeof setInterval> | null = null;

const total = computed(() => list.value.trackedCount + list.value.orphanCount);
const tracked = computed(() => list.value.processes.filter((p) => p.role === "tracked"));
const orphans = computed(() => list.value.processes.filter((p) => p.role === "orphan"));

const KIND_LABEL: Record<string, string> = {
  session: "会话桥接",
  enhance: "提示词增强",
  modelTest: "模型探测",
};

async function refresh() {
  loading.value = true;
  try {
    list.value = await listCcBridgeProcesses();
  } finally {
    loading.value = false;
  }
}

async function toggle() {
  open.value = !open.value;
  if (open.value) await refresh();
}

async function onKill(pid: number) {
  await killCcBridgeProcess(pid);
  await refresh();
}

function formatElapsed(p: CcBridgeProcessEntry): string {
  if (p.startedAtMs == null) return "—";
  const sec = Math.max(0, Math.floor((now.value - p.startedAtMs) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

onMounted(() => {
  void refresh();
  tickTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer);
});

defineExpose({ refresh });
</script>
```

模板：按钮 `title="Node 进程"`，文案 `Node 进程` + `N`；面板标题 `共 N 个 · 孤立 M 个`；刷新 / 分组列表 / 终止（`X` 图标）；`data-testid="cc-bridge-process-menu"`。  
样式：复用 `cc-workbench-icon-btn` + 与 status panel 相近的 `border border-border bg-surface-0 shadow` popover（宽度约 288px，右对齐）。

点击外部关闭：`onMounted` 监听 `pointerdown`，若在 root 外则 `open=false`。

- [ ] **Step 2: 挂到 Shell**

在 `CcWorkbenchShell.vue`：

```ts
import CcBridgeProcessMenu from "./chat/CcBridgeProcessMenu.vue";
```

在设置按钮**之前**：

```vue
<CcBridgeProcessMenu />
<button
  type="button"
  class="cc-workbench-icon-btn"
  title="工作台设置"
  @click="openSettings"
>
```

可选：`watch(streaming, () => menuRef.value?.refresh())` 以更新角标。

- [ ] **Step 3: 前端验证**

```bash
pnpm verify:fe
```

Expected: 通过

---

### Task 6: 文档与冒烟

**Files:**
- Modify: `docs/superpowers/specs/2026-07-14-cc-bridge-process-manager-design.md`（状态 → 已实现；验收勾选）
- Modify: `docs/superpowers/specs/2026-07-10-cc-workbench-design.md` §17.4 状态 → 已实现；§14 可增一句「Node 进程面板」
- Optional: `AGENTS.md` Agent 工作台表加一行「进程管理」

- [ ] **Step 1: 更新 spec 状态与验收勾选**

- [ ] **Step 2: Rust 测试 + FE verify**

```bash
cd src-tauri && cargo test is_lizhi_bridge_cmdline
pnpm verify:fe
```

- [ ] **Step 3: Tauri 冒烟（人工）**

`pnpm tauri dev` → Agent 工作台发消息 → 顶栏 `Node 进程` ≥1 → 打开面板见 PID → 终止 → 流式停止；输入框停止仍可用。

- [ ] **Step 4: Commit（仅用户要求时）**

```bash
git add src-tauri/src/cc_workbench src-tauri/src/commands.rs src-tauri/src/lib.rs \
  src/services/ccWorkbenchService.ts src/components/cc/chat/CcBridgeProcessMenu.vue \
  src/components/cc/CcWorkbenchShell.vue docs/superpowers/specs
git commit -m "feat(cc): Node/ai-bridge process manager in workbench"
```

---

## Spec coverage checklist

| Spec 要求 | Task |
|-----------|------|
| 登记 session/enhance/modelTest | T1–T2 |
| 孤立 cmdline 扫描 | T2 |
| list / kill IPC | T2–T3 |
| abort 与 kill session 共用清理 | T2–T3 |
| 顶栏入口 + popover | T5 |
| 非 Tauri 空列表 | T4 |
| 验收 / 文档 | T6 |
| 不做 Daemon / 任意 Node / 自动重发 | 全任务不引入 |

## Placeholder / 类型一致性自检

- `kind`：`session` \| `enhance` \| `modelTest`（Rust 字符串 + TS union）一致  
- `role`：`tracked` \| `orphan`  
- Command 名：`list_cc_bridge_processes` / `kill_cc_bridge_process`  
- 避免 `bridge_processes` ↔ `runtime` 循环依赖（由 commands 编排 session 清理）
