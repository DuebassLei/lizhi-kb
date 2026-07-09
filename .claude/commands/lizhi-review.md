---
description: 审查当前工作区变更（安全 + spec + 质量）
argument-hint: [可选：重点文件或 concern]
allowed-tools:
  - Agent
  - Read
  - Bash
---

# /lizhi-review

Spawn `reviewer`：

> 审查 lizhi-kb 当前变更。$ARGUMENTS  
> 运行 git diff 了解范围。重点：加密安全、Tauri IPC、TipTap、与 spec 一致性。  
> 输出阻塞/建议/通过项。不修改代码。

若 git 无变更，提示用户先实现或指定文件路径。
