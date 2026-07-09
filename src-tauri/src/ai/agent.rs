use std::sync::Arc;

use serde_json::json;
use tauri::ipc::Channel;

use crate::AppState;

use super::config::AiConfig;
use super::llm_client::chat_once;
use super::rag::format_hits_for_agent;
use super::secrets::AiSecrets;
use super::types::{AgentRequest, ChatMessage, StreamEvent, resolve_cloud_provider_id};

const AGENT_SYSTEM: &str = r#"你是狸知知识库「笔记助手」，只操作用户的本地加密笔记库，不负责通用闲聊或百科问答。

## 边界
- 用户问概念、编程、写作、闲聊等与笔记库无关的问题时，用 finish 回复：
  「这类问题请切换到「闲聊」模式。笔记助手仅用于搜索、阅读和写入笔记。」
- 用户只想「查笔记里写了什么」时，建议用 finish 提示切换到「知识库」模式；若用户明确要求整理/写入/批量操作，则继续用工具。

## 工具
- search(query): 全文搜索笔记
- read(id): 读取笔记正文
- create(title, folder?): 创建笔记（需写权限）
- save(id, content): 保存笔记（需写权限）

## 工作方式
1. 先 search，必要时 read，再总结或 save。
2. 搜索无结果时如实说明，不要编造笔记内容。
3. 无写权限时告知用户去「设置 → AI 助手」开启「笔记助手允许写笔记」。

## 输出格式
需要工具时，仅回复一行 JSON：
{"tool":"search","args":{"query":"关键词"}}
{"tool":"read","args":{"id":"doc-id"}}
{"tool":"create","args":{"title":"标题","folder":"知识库"}}
{"tool":"save","args":{"id":"doc-id","content":"markdown内容"}}

任务完成或需直接回复用户时：
{"tool":"finish","args":{"summary":"给用户的中文回答"}}

不要输出其它格式或多行 JSON。"#;

const MAX_AGENT_STEPS: usize = 6;

pub async fn agent_run_stream(
    state: Arc<AppState>,
    config: Arc<AiConfig>,
    secrets: Arc<AiSecrets>,
    request: AgentRequest,
    dek: Option<[u8; 32]>,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    if !config.enabled {
        return Err("AI 助手未启用".into());
    }

    let mut conversation = if request.messages.is_empty() {
        vec![ChatMessage {
            role: "user".into(),
            content: request.instruction.clone(),
        }]
    } else {
        request.messages.clone()
    };

    if conversation.last().map(|m| m.role.as_str()) != Some("user") {
        conversation.push(ChatMessage {
            role: "user".into(),
            content: request.instruction.clone(),
        });
    }

    let mut history = vec![ChatMessage {
        role: "system".into(),
        content: AGENT_SYSTEM.into(),
    }];
    history.append(&mut conversation);

    let provider_id = resolve_cloud_provider_id(
        request.cloud_provider_id.clone(),
        request.use_cloud,
        config.active_cloud_provider_id.as_deref(),
    );
    let provider_ref = provider_id.as_deref();

    for _step in 0..MAX_AGENT_STEPS {
        let reply = chat_once(&config, &secrets, history.clone(), provider_ref).await?;
        let trimmed = reply.trim();

        let parsed: serde_json::Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => {
                let _ = on_event.send(StreamEvent::Token {
                    content: trimmed.to_string(),
                });
                let _ = on_event.send(StreamEvent::Done);
                return Ok(());
            }
        };

        let tool = parsed
            .get("tool")
            .and_then(|v| v.as_str())
            .unwrap_or("finish");
        let args = parsed.get("args").cloned().unwrap_or(json!({}));

        if tool == "finish" {
            let summary = args
                .get("summary")
                .and_then(|v| v.as_str())
                .unwrap_or("任务已完成");
            let _ = on_event.send(StreamEvent::Token {
                content: summary.to_string(),
            });
            let _ = on_event.send(StreamEvent::Done);
            return Ok(());
        }

        let input = args.to_string();
        let _ = on_event.send(StreamEvent::ToolCall {
            name: tool.to_string(),
            input: input.clone(),
        });

        let output = execute_tool(&state, &config, tool, &args, dek.as_ref()).await?;
        let _ = on_event.send(StreamEvent::ToolResult {
            name: tool.to_string(),
            output: output.clone(),
        });

        history.push(ChatMessage {
            role: "assistant".into(),
            content: trimmed.to_string(),
        });
        history.push(ChatMessage {
            role: "user".into(),
            content: format!("工具结果:\n{output}"),
        });
    }

    let _ = on_event.send(StreamEvent::Error {
        message: "Agent 已达到最大步骤数".into(),
    });
    Ok(())
}

async fn execute_tool(
    state: &AppState,
    config: &AiConfig,
    tool: &str,
    args: &serde_json::Value,
    dek: Option<&[u8; 32]>,
) -> Result<String, String> {
    match tool {
        "search" => {
            let query = args
                .get("query")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "search 需要 query".to_string())?;
            let doc_service = state
                .document_service
                .lock()
                .map_err(|_| "document service lock poisoned".to_string())?;
            let hits = doc_service
                .search_documents(query, 10, dek)
                .map_err(|e| e.to_string())?;
            Ok(format_hits_for_agent(&hits))
        }
        "read" => {
            let id = args
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "read 需要 id".to_string())?;
            let doc_service = state
                .document_service
                .lock()
                .map_err(|_| "document service lock poisoned".to_string())?;
            let doc = doc_service
                .read_document(id, dek)
                .map_err(|e| e.to_string())?;
            let title = doc_service
                .list_documents()
                .ok()
                .and_then(|docs| docs.into_iter().find(|d| d.id == id).map(|d| d.title))
                .unwrap_or_else(|| id.to_string());
            let excerpt = if doc.content.chars().count() > 4000 {
                let s: String = doc.content.chars().take(4000).collect();
                format!("{s}…")
            } else {
                doc.content
            };
            Ok(format!("标题: {title}\n\n{excerpt}", title = title))
        }
        "create" => {
            if !config.write_enabled {
                return Err("写操作未启用，请在设置中开启 Agent 写笔记".into());
            }
            let title = args
                .get("title")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "create 需要 title".to_string())?;
            let folder = args.get("folder").and_then(|v| v.as_str()).map(str::to_string);
            let mut doc_service = state
                .document_service
                .lock()
                .map_err(|_| "document service lock poisoned".to_string())?;
            let doc = doc_service
                .create_document(title.to_string(), folder, dek)
                .map_err(|e| e.to_string())?;
            Ok(format!("已创建文档 {} ({})", doc.title, doc.id))
        }
        "save" => {
            if !config.write_enabled {
                return Err("写操作未启用，请在设置中开启 Agent 写笔记".into());
            }
            let id = args
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "save 需要 id".to_string())?;
            let content = args
                .get("content")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "save 需要 content".to_string())?;
            let mut doc_service = state
                .document_service
                .lock()
                .map_err(|_| "document service lock poisoned".to_string())?;
            doc_service
                .save_document(id, content, dek)
                .map_err(|e| e.to_string())?;
            Ok(format!("已保存文档 {id}"))
        }
        other => Err(format!("未知工具: {other}")),
    }
}
