# 安全与导出审计（最小必要集）· 设计 Spec

**文档版本**：v1.0.0  
**日期**：2026-07-14  
**状态**：落地实现  
**关联**：`2026-07-06-lizhi-kb-complete-design.md`（Insights 审计摘要）；水印 / 导出安全叙事见 complete-design §5

---

## 0. 决策摘要

| 项 | 决策 |
|----|------|
| **范围** | 仅安全（解锁/锁定）+ 知识库导出；接通现有脚手架 |
| **存储** | `~/.lizhi-kb/audit-events.jsonl`（现有 `audit.rs`） |
| **UI** | 复用 Insights「安全与导出审计」`AuditTab` |
| **不做** | 文档 CRUD/保存审计、全链路追踪、诊断包、云上报、SQLite 审计表、`category`/`outcome` 扩展 |

---

## 1. 事件清单

| eventType | 中文（前端 label） | 触发 |
|-----------|-------------------|------|
| `unlock` | 解锁知识库 | `unlock_vault` / `unlock_vault_with_recovery` 成功 |
| `unlock_fail` | 解锁失败 | 同上失败（detail 不含密码/助记词） |
| `lock` | 锁定知识库 | `lock_vault` 成功 |
| `export` | 导出文档 | `export_markdown_folder` 且文件数 ≤ 1 |
| `export_batch` | 批量导出 | `export_markdown_folder` 且文件数 > 1 |
| `export_obsidian` | Obsidian 导出 | `export_obsidian_vault` 成功 |
| `export_vault` | 备份导出 | `export_vault` 成功 |

**不记**：`write_export_file`（通用写文件，含日记/会话等）、CC agents/prompts 导出。

写入失败不阻断主流程。密钥、密码、正文不进 `detail`；可选 detail 仅为计数类元数据（如 `files:3`）。

---

## 2. Schema

保持现有结构（camelCase JSONL）：

```ts
{ id: string; eventType: string; detail?: string | null; createdAt: number }
```

IPC：`list_audit_events({ limit })` → `AuditEvent[]`。

---

## 3. 验收

- [ ] 解锁失败 → 列表见「解锁失败」
- [ ] 解锁成功 → 「解锁知识库」；锁定 → 「锁定知识库」
- [ ] Markdown 文件夹 / Obsidian / `.lizhi` 备份导出成功 → 对应导出条目
- [ ] Insights 审计页不再因缺少 `list_audit_events` 失败
- [ ] `pnpm verify` 零警告
