use std::collections::HashSet;
use std::sync::Arc;

use tauri::ipc::Channel;

use crate::documents::{DecryptedContent, DocumentMeta, SearchHit};
use crate::AppState;

use super::config::AiConfig;
use super::llm_client::chat_stream;
use super::secrets::AiSecrets;
use crate::text_util::{extract_search_terms, excerpt_around_terms};
use super::types::{ChatMessage, RagRequest, RagScope, StreamEvent, resolve_cloud_provider_id};

const RAG_SYSTEM: &str = "你是狸知知识库助手。基于提供的笔记上下文（含代码块摘录）回答；上下文中出现的关键词即视为有相关内容的依据。若上下文确实不包含答案再说明。不要捏造未出现的来源。";

pub struct RagContext {
    pub chunks: Vec<String>,
    pub citations: Vec<(String, String)>,
}

pub fn build_rag_context(
    state: &AppState,
    request: &RagRequest,
    dek: Option<&[u8; 32]>,
    top_k: usize,
) -> Result<RagContext, String> {
    let doc_service = state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?;

    let all_docs = doc_service
        .list_documents()
        .map_err(|e| e.to_string())?;

    let scoped_ids = scope_document_ids(&all_docs, request);
    let query_terms = extract_search_terms(&request.question);

    let mut hits = doc_service
        .search_documents(&request.question, top_k * 3, dek)
        .map_err(|e| e.to_string())?;

    if let Some(ids) = scoped_ids {
        let set: HashSet<&str> = ids.iter().map(String::as_str).collect();
        hits.retain(|h| set.contains(h.id.as_str()));
    }

    hits.truncate(top_k);

    let mut chunks = Vec::new();
    let mut citations = Vec::new();
    let mut seen = HashSet::new();

    if let Some(selection) = request.selection.as_ref().filter(|s| !s.trim().is_empty()) {
        chunks.push(format!("【编辑器选区】\n{}", selection.trim()));
    }

    for hit in &hits {
        if !seen.insert(hit.id.clone()) {
            continue;
        }
        citations.push((hit.id.clone(), hit.title.clone()));
        match doc_service.read_document(&hit.id, dek) {
            Ok(DecryptedContent { content, .. }) => {
                let excerpt = excerpt_around_terms(&content, &query_terms, 4000);
                chunks.push(format!("【{}】\n{excerpt}", hit.title));
            }
            Err(_) => {
                chunks.push(format!("【{}】\n{}", hit.title, hit.snippet));
            }
        }
    }

    if hits.is_empty() {
        if matches!(request.scope, RagScope::CurrentDocument) {
            if let Some(doc_id) = request.document_id.as_ref().filter(|id| !id.is_empty()) {
                if let Some(meta) = all_docs.iter().find(|d| d.id == *doc_id) {
                    if let Ok(DecryptedContent { content, .. }) = doc_service.read_document(doc_id, dek) {
                        if !content.trim().is_empty() {
                            citations.push((doc_id.clone(), meta.title.clone()));
                            let excerpt = excerpt_around_terms(&content, &query_terms, 4000);
                            chunks.push(format!("【{}】\n{excerpt}", meta.title));
                        }
                    }
                }
            }
        }
    }

    if chunks.is_empty() {
        chunks.push("（未检索到相关笔记）".into());
    }

    Ok(RagContext { chunks, citations })
}

fn format_chunk_markdown(chunk: &str) -> String {
    if let Some(rest) = chunk.strip_prefix("【编辑器选区】\n") {
        return format!("### 编辑器选区\n\n{rest}");
    }
    if chunk.starts_with('【') {
        if let Some(end) = chunk.find('】') {
            let title = chunk.get(3..end).unwrap_or("笔记");
            let body = chunk
                .get(end + '】'.len_utf8()..)
                .unwrap_or("")
                .trim_start_matches('\n');
            return format!("### {title}\n\n{body}");
        }
    }
    chunk.to_string()
}

pub fn format_retrieval_answer(question: &str, rag: &RagContext) -> String {
    let has_real_hits = !rag.citations.is_empty()
        && !rag
            .chunks
            .iter()
            .any(|c| c.as_str() == "（未检索到相关笔记）");

    if !has_real_hits {
        return format!(
            "未在知识库中找到与「{}」相关的笔记。\n\n可尝试：\n- 更换或缩短关键词\n- 使用 **Cmd+K** 在工作区搜索\n- 将检索范围改为「全库」",
            question.trim()
        );
    }

    let n = rag.citations.len();
    let mut out = format!(
        "根据全文检索，共找到 **{n}** 篇相关笔记（仅检索模式，未调用大模型）：\n\n"
    );

    for chunk in &rag.chunks {
        if chunk.as_str() == "（未检索到相关笔记）" {
            continue;
        }
        out.push_str(&format_chunk_markdown(chunk));
        out.push_str("\n\n---\n\n");
    }

    out.push_str("点击上方引用标签可跳转到对应笔记。");
    out
}

fn scope_document_ids(docs: &[DocumentMeta], request: &RagRequest) -> Option<Vec<String>> {
    match request.scope {
        RagScope::All => None,
        RagScope::CurrentDocument => {
            let id = request.document_id.as_ref()?;
            Some(vec![id.clone()])
        }
        RagScope::CurrentFolder => {
            let folder = request.folder.as_ref()?;
            Some(
                docs.iter()
                    .filter(|d| d.folder == *folder)
                    .map(|d| d.id.clone())
                    .collect(),
            )
        }
    }
}

pub async fn rag_query_stream(
    state: Arc<AppState>,
    config: Arc<AiConfig>,
    secrets: Arc<AiSecrets>,
    request: RagRequest,
    dek: Option<[u8; 32]>,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    if !config.enabled {
        return Err("AI 助手未启用".into());
    }

    let top_k = config.rag_top_k as usize;
    let rag = build_rag_context(&state, &request, dek.as_ref(), top_k)?;

    for (id, title) in &rag.citations {
        let _ = on_event.send(StreamEvent::Citation {
            id: id.clone(),
            title: title.clone(),
        });
    }

    if request.retrieval_only {
        let answer = format_retrieval_answer(&request.question, &rag);
        let _ = on_event.send(StreamEvent::Token { content: answer });
        let _ = on_event.send(StreamEvent::Done);
        return Ok(());
    }

    let context = rag.chunks.join("\n\n---\n\n");
    let messages = vec![
        ChatMessage {
            role: "system".into(),
            content: format!("{RAG_SYSTEM}\n\n## 笔记上下文\n\n{context}"),
        },
        ChatMessage {
            role: "user".into(),
            content: request.question,
        },
    ];

    let provider_id = resolve_cloud_provider_id(
        request.cloud_provider_id.clone(),
        request.use_cloud,
        config.active_cloud_provider_id.as_deref(),
    );

    chat_stream(config, secrets, messages, provider_id, on_event).await
}

#[allow(dead_code)]
pub fn format_hits_for_agent(hits: &[SearchHit]) -> String {
    if hits.is_empty() {
        return "（知识库搜索无匹配。若用户问题不依赖笔记，请直接用 finish 基于通用知识回答。）".into();
    }
    hits.iter()
        .map(|h| format!("- {} (id={}): {}", h.title, h.id, h.snippet))
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_retrieval_answer_empty() {
        let rag = RagContext {
            chunks: vec!["（未检索到相关笔记）".into()],
            citations: vec![],
        };
        let answer = format_retrieval_answer("测试问题", &rag);
        assert!(answer.contains("未在知识库中找到"));
        assert!(answer.contains("测试问题"));
    }

    #[test]
    fn format_retrieval_answer_with_hits() {
        let rag = RagContext {
            chunks: vec![
                "【笔记 A】\n这是关于 SD-WAN 的摘录内容。".into(),
                "【笔记 B】\n另一段相关内容。".into(),
            ],
            citations: vec![
                ("id-a".into(), "笔记 A".into()),
                ("id-b".into(), "笔记 B".into()),
            ],
        };
        let answer = format_retrieval_answer("SD-WAN", &rag);
        assert!(answer.contains("**2** 篇相关笔记"));
        assert!(answer.contains("### 笔记 A"));
        assert!(answer.contains("SD-WAN 的摘录"));
    }
}
