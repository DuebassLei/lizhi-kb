# 任务模板 · Tauri 后端

## 元信息

| 字段 | 值 |
|------|-----|
| 类型 | tauri-backend |
| Command 名 | `command_name` |
| 数据 | vault / 文档 / 文件系统 |

## 接口契约

### Rust Command

```rust
// src-tauri/src/...
#[tauri::command]
async fn command_name(/* args */) -> Result<T, String> { ... }
```

### 前端调用

```typescript
// composables/useTauriCommand.ts 或 services/
await invoke('command_name', { ... })
```

## 安全清单

- [ ] 输入校验（路径 traversal、长度限制）
- [ ] 仅在 vault 解锁后执行敏感操作
- [ ] 密钥材料仅在 Rust 侧，零化/ drop 敏感 buffer
- [ ] `capabilities/` 最小权限
- [ ] 错误信息不泄露密钥或明文路径

## 验收标准

- [ ] Command 注册于 `lib.rs` / 模块
- [ ] TypeScript 类型与 Rust 一致
- [ ] 前端错误处理用户可读（中文）
- [ ] `cargo check` / `pnpm tauri build` 通过

## Agent 编排

```
Planner（IPC 契约）→ Implementer Rust + TS 胶水 → Reviewer（安全审计）
```

## 验证

```bash
pnpm tauri dev
cargo check --manifest-path src-tauri/Cargo.toml
```
