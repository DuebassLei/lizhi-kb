---
paths:
  - "src-tauri/**"
---

# Tauri / Rust 规则

与 Cursor 规则 `.cursor/rules/tauri-rust.mdc` 语义一致。

## 安全

- 密钥仅 Rust 侧；vault 解锁门禁；路径校验；capabilities 最小权限
- 日志禁止密钥/明文

## 桥接

- 前端经 `useTauriCommand` / `services/` 调用 IPC

## 验证

`pnpm tauri dev` · `pnpm verify:rust` · `pnpm verify`（Rust `-Dwarnings`）
