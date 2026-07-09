# 狸知知识库 · AI 对话问答功能设计

**文档版本**：v1.0.0  
**更新日期**：2026-07-08  
**状态**：已实现（v1.6 灵狸）

---

## 1. 目标

在保持「本地加密、opt-in 外联」产品叙事前提下，为狸知知识库新增应用内 AI 对话：

- 混合 LLM（本地 Ollama 优先 + 可选云端 OpenAI 兼容 API）
- RAG 检索问答（FTS5）
- 通用闲聊（不访问笔记）
- RAG 检索问答（FTS5）
- 笔记助手：搜索/读/写笔记（opt-in `writeEnabled`）

## 2. 架构

```
ChatPanel (Vue) → aiService → Tauri IPC → ai/* (Rust)
                                              ├── config / secrets
                                              ├── network_gate
                                              ├── llm_client (streaming)
                                              ├── rag (FTS5)
                                              └── agent (tool loop)
                                              ↓
                                    DocumentService / search_index
```

与 MCP 并列：MCP 服务外部 AI 工具；应用内 Chat 直连 Rust 域服务（不绕 HTTP MCP）。

## 3. 配置

路径：`~/.lizhi-kb/ai-config.json`，API Key：`~/.lizhi-kb/ai-secrets.json`（仅 Rust 读写）

| 字段 | 默认 | 说明 |
|------|------|------|
| `enabled` | `false` | 总开关 |
| `cloudEnabled` | `false` | 云端 API opt-in |
| `writeEnabled` | `false` | 笔记助手写笔记 |
| `localBaseUrl` | `http://127.0.0.1:11434` | Ollama |
| `ragTopK` | `8` | RAG 检索条数 |

## 4. Tauri Commands

| Command | 说明 |
|---------|------|
| `get_ai_config` | 读取配置（可选 revealKey） |
| `set_ai_config` | 更新配置 |
| `test_ai_connection` | 测试本地/云端连通 |
| `ai_chat_stream` | 闲聊流式 |
| `ai_rag_query` | RAG 流式 |
| `ai_agent_run` | 笔记助手流式 |

`StreamEvent`：`token` | `citation` | `toolCall` | `toolResult` | `done` | `error`

## 5. UI

- 工作区右栏 `ChatPanel`（`Cmd+Shift+A`）
- 模式：闲聊（通用）| 知识库（检索问答）| 笔记助手（操作笔记）；各模式会话独立
- 设置页 `AiSettingsPanel`（opt-in + 风险提示）

## 6. 安全

- LLM 请求仅 Rust 发起；API Key 不进前端明文（masked）
- `network_gate` 白名单 host
- vault 锁定后会话清空
- RAG/Agent 仅发送检索 chunk 或用户显式工具结果

## 7. 分阶段

| 阶段 | 交付 |
|------|------|
| P1 | 设置 + Ollama 闲聊 + 流式 Panel |
| P2 | FTS RAG + 引用跳转 |
| P3 | 笔记助手 search/read/write |

## 8. 不在范围

- Embedding 向量库、多会话持久化、多模态、语音
