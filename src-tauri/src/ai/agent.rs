use std::collections::HashSet;
use std::sync::Arc;

use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::json;
use tauri::ipc::Channel;

use crate::AppState;

use super::config::AiConfig;
use super::llm_client::chat_once;
use super::rag::format_hits_for_agent;
use super::secrets::AiSecrets;
use super::types::{AgentRequest, ChatMessage, RagScope, StreamEvent, resolve_cloud_provider_id};

const AGENT_SYSTEM: &str = r#"你是狸知知识库「笔记助手」，只操作用户的本地加密笔记库，不负责通用闲聊或百科问答。

## 核心原则
- **先搜索，再判断**：任何问题都先用 search 查一遍笔记库，确认无相关内容后才能告知用户"未找到"。
- 不要仅凭问题字面就判定"与笔记无关"——用户可能用简短措辞询问笔记里已有的内容。

## 边界
- 搜索后确认笔记库中无相关内容，且问题明显是通用概念/编程/闲聊时，用 finish 回复：
  「笔记库中未找到相关内容。这类通用问题请切换到「闲聊」模式。」
- 用户只想「查笔记里写了什么」时，建议用 finish 提示切换到「知识库」模式；若用户明确要求整理/写入/批量操作，则继续用工具。

## 工具
- search(query): 全文搜索笔记
- read(id): 读取笔记正文
- create(title, folder?): 创建笔记（需写权限）
- save(id, content): 保存笔记（需写权限）

## 工作方式
1. **先用用户原话 search**。如果无结果，尝试拆分关键词或换同义词重新 search（如"大模型"→"LLM"、"模型"、"AI"、"GPT"）。
2. 找到相关笔记后用 read 读取正文，再总结或 save。
3. 最多尝试 3 次不同关键词的 search，都无结果后才如实说明"笔记库中未找到相关内容"。
4. 不要编造笔记内容。无写权限时告知用户去「设置 → AI 助手」开启「笔记助手允许写笔记」。

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

static THINKING_BLOCK: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"(?is)<{}>(.*?)</{}>",
        "think", "think"
    ))
    .unwrap()
});
static REDACTED_THINKING_BLOCK: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?is)<think>(.*?)</think>").unwrap()
});
static ORPHAN_THINKING_TAGS: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)</?(?:think|redacted_thinking)>").unwrap()
});

/// 从模型回复中剥离 thinking / redacted_thinking 标签，返回 (思考内容, 剩余正文)。
fn split_agent_reply(raw: &str) -> (Option<String>, String) {
    let mut thinking_parts: Vec<String> = Vec::new();
    let mut text = raw.to_string();

    for re in [&*THINKING_BLOCK, &*REDACTED_THINKING_BLOCK] {
        text = re
            .replace_all(&text, |caps: &regex::Captures| {
                if let Some(m) = caps.get(1) {
                    let inner = m.as_str().trim();
                    if !inner.is_empty() {
                        thinking_parts.push(inner.to_string());
                    }
                }
                ""
            })
            .into_owned();
    }

    text = ORPHAN_THINKING_TAGS.replace_all(&text, "").into_owned();
    let thinking = if thinking_parts.is_empty() {
        None
    } else {
        Some(thinking_parts.join("\n"))
    };
    (thinking, text.trim().to_string())
}

fn strip_code_fence(text: &str) -> String {
    let trimmed = text.trim();
    if !trimmed.starts_with("```") {
        return trimmed.to_string();
    }
    let mut lines = trimmed.lines();
    let _ = lines.next();
    let body: String = lines.collect::<Vec<_>>().join("\n");
    if let Some(end) = body.rfind("```") {
        body[..end].trim().to_string()
    } else {
        body.trim().to_string()
    }
}

fn matching_brace_end(s: &str) -> Option<usize> {
    let bytes = s.as_bytes();
    let mut depth = 0i32;
    let mut in_string = false;
    let mut escape = false;

    for (i, &b) in bytes.iter().enumerate() {
        if in_string {
            if escape {
                escape = false;
            } else if b == b'\\' {
                escape = true;
            } else if b == b'"' {
                in_string = false;
            }
            continue;
        }

        match b {
            b'"' => in_string = true,
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
    }
    None
}

fn find_json_object_with_tool(text: &str) -> Option<String> {
    let mut search_start = 0;
    while let Some(rel) = text[search_start..].find("\"tool\"") {
        let abs_tool = search_start + rel;
        let start = text[..=abs_tool].rfind('{')?;
        let slice = &text[start..];
        let end = matching_brace_end(slice)?;
        let candidate = &slice[..=end];
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(candidate) {
            if v.get("tool").and_then(|t| t.as_str()).is_some() {
                return Some(candidate.to_string());
            }
        }
        search_start = abs_tool + 6;
    }
    None
}

/// 解析笔记助手工具调用 JSON（兼容 thinking 标签、markdown 代码块、前后缀文字）。
fn parse_agent_tool_call(raw: &str) -> Option<serde_json::Value> {
    let cleaned = strip_code_fence(raw.trim());
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&cleaned) {
        if v.get("tool").and_then(|t| t.as_str()).is_some() {
            return Some(v);
        }
    }
    find_json_object_with_tool(&cleaned).and_then(|json| serde_json::from_str(&json).ok())
}

fn scope_document_ids(docs: &[crate::documents::DocumentMeta], scope: RagScope, doc_id: Option<&str>, folder: Option<&str>) -> Option<Vec<String>> {
    match scope {
        RagScope::All => None,
        RagScope::CurrentDocument => {
            let id = doc_id?;
            Some(vec![id.to_string()])
        }
        RagScope::CurrentFolder => {
            let folder = folder?;
            Some(
                docs.iter()
                    .filter(|d| d.folder == folder)
                    .map(|d| d.id.clone())
                    .collect(),
            )
        }
    }
}

fn build_scope_context(docs: &[crate::documents::DocumentMeta], request: &AgentRequest) -> String {
    match request.scope {
        RagScope::All => String::new(),
        RagScope::CurrentDocument => {
            if let Some(ref doc_id) = request.document_id {
                if let Some(meta) = docs.iter().find(|d| d.id == *doc_id) {
                    let folder_display = if meta.folder.is_empty() { "根目录".to_string() } else { meta.folder.clone() };
                    return format!("当前用户正在查看的笔记：{}（文件夹：{}）\n请在搜索和回答时优先参考这篇笔记的内容。", meta.title, folder_display);
                }
            }
            String::new()
        }
        RagScope::CurrentFolder => {
            if let Some(ref folder) = request.folder {
                let count = docs.iter().filter(|d| d.folder == *folder).count();
                return format!("当前用户限定的搜索范围：文件夹「{}」（共 {} 篇笔记）\n请只在这个文件夹内的笔记中搜索信息。", folder, count);
            }
            String::new()
        }
    }
}

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

    // 构建范围上下文，注入 system prompt
    let all_docs = {
        let doc_service = state
            .document_service
            .lock()
            .map_err(|_| "document service lock poisoned".to_string())?;
        let docs = doc_service
            .list_documents()
            .map_err(|e| e.to_string())?;
        drop(doc_service);
        docs
    };
    let scope_context = build_scope_context(&all_docs, &request);

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

    let system_content = if scope_context.is_empty() {
        AGENT_SYSTEM.to_string()
    } else {
        format!("{}\n\n## 当前上下文\n\n{}", AGENT_SYSTEM, scope_context)
    };
    let mut history = vec![ChatMessage {
        role: "system".into(),
        content: system_content,
    }];
    history.append(&mut conversation);

    let provider_id = resolve_cloud_provider_id(
        request.cloud_provider_id.clone(),
        request.use_cloud,
        config.active_cloud_provider_id.as_deref(),
    );
    let provider_ref = provider_id.as_deref();

    let scoped_ids = scope_document_ids(
        &all_docs,
        request.scope,
        request.document_id.as_deref(),
        request.folder.as_deref(),
    );

    for _step in 0..MAX_AGENT_STEPS {
        let reply = chat_once(&config, &secrets, history.clone(), provider_ref).await?;
        let (thinking, payload) = split_agent_reply(&reply);

        if let Some(thinking) = thinking.filter(|s| !s.is_empty()) {
            let _ = on_event.send(StreamEvent::Thinking {
                content: thinking,
            });
        }

        let parsed = match parse_agent_tool_call(&payload) {
            Some(v) => v,
            None => {
                let display = if payload.contains("\"tool\"") {
                    "笔记助手未能解析模型返回的工具指令，请重试。".to_string()
                } else if payload.is_empty() {
                    "模型未返回有效回复，请重试。".to_string()
                } else {
                    payload
                };
                let _ = on_event.send(StreamEvent::Token { content: display });
                let _ = on_event.send(StreamEvent::Done);
                return Ok(());
            }
        };

        let tool = parsed
            .get("tool")
            .and_then(|v| v.as_str())
            .unwrap_or("finish");
        let args = parsed.get("args").cloned().unwrap_or(json!({}));
        let tool_json = parsed.to_string();

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
            tool_use_id: None,
        });

        let output = execute_tool(&state, &config, tool, &args, &scoped_ids, dek.as_ref()).await?;
        let _ = on_event.send(StreamEvent::ToolResult {
            name: tool.to_string(),
            output: output.clone(),
            tool_use_id: None,
        });

        history.push(ChatMessage {
            role: "assistant".into(),
            content: tool_json,
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
    scoped_ids: &Option<Vec<String>>,
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
            let mut hits = doc_service
                .search_documents_for_ai(query, 10, dek)
                .map_err(|e| e.to_string())?;
            if let Some(ids) = scoped_ids {
                let set: HashSet<&str> = ids.iter().map(String::as_str).collect();
                hits.retain(|h| set.contains(h.id.as_str()));
            }
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
                .read_document_for_ai(id, dek)
                .map_err(|e| e.to_string())?;
            let title = doc_service
                .list_documents()
                .ok()
                .and_then(|docs| {
                    docs.into_iter()
                        .find(|d| d.id == id && !d.ai_exclude)
                        .map(|d| d.title)
                })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_pure_json_tool_call() {
        let raw = r#"{"tool":"search","args":{"query":"大模型"}}"#;
        let parsed = parse_agent_tool_call(raw).expect("should parse");
        assert_eq!(parsed["tool"], "search");
        assert_eq!(parsed["args"]["query"], "大模型");
    }

    #[test]
    fn parse_json_wrapped_in_thinking_tags() {
        let raw = concat!(
            "<think>先搜索笔记库</think>",
            r#"{"tool":"search","args":{"query":"大模型"}}"#
        );
        let (thinking, payload) = split_agent_reply(raw);
        assert!(thinking.is_some());
        assert!(payload.contains("\"tool\""));
        let parsed = parse_agent_tool_call(&payload).expect("should parse");
        assert_eq!(parsed["tool"], "search");
    }

    #[test]
    fn parse_json_in_markdown_fence() {
        let raw = "```json\n{\"tool\":\"search\",\"args\":{\"query\":\"SQL\"}}\n```";
        let parsed = parse_agent_tool_call(raw).expect("should parse");
        assert_eq!(parsed["args"]["query"], "SQL");
    }

    #[test]
    fn parse_json_with_leading_text() {
        let raw = r#"好的，我来搜索。
{"tool":"search","args":{"query":"关键词"}}"#;
        let parsed = parse_agent_tool_call(raw).expect("should parse");
        assert_eq!(parsed["tool"], "search");
    }

    #[test]
    fn parse_redacted_thinking_then_json() {
        let raw = concat!(
            "<think>分析用户意图</think>",
            r#"{"tool":"finish","args":{"summary":"完成"}}"#
        );
        let (thinking, payload) = split_agent_reply(raw);
        assert_eq!(thinking.as_deref(), Some("分析用户意图"));
        let parsed = parse_agent_tool_call(&payload).expect("should parse");
        assert_eq!(parsed["tool"], "finish");
    }
}
