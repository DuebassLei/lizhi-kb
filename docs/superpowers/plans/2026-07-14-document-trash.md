# Document Trash (Recycle Bin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soft-delete documents into a recycle bin with restore, UI/MCP hard purge, configurable retention (default 30 days), and auto-purge on vault unlock / opening trash.

**Architecture:** Add nullable `documents.deleted_at` (millis, same unit as `created_at`). `delete_document` becomes soft-delete; new `purge_document` / `restore_document` / `list_trashed_documents` / `empty_trash` / `purge_expired_documents` plus retention prefs on `VaultUiState`. Active queries filter `deleted_at IS NULL`. Frontend: dual confirm, tree row icons side-by-side, sidebar trash + `TrashPanel` via `workspaceViewMode: "trash"`.

**Tech Stack:** Vue 3 + Pinia + Tauri 2, Rusqlite/SQLCipher, `packages/lizhi-mcp`, vault-ui-state.json

**Spec:** [docs/superpowers/specs/2026-07-14-document-trash-design.md](../specs/2026-07-14-document-trash-design.md) (v1.0.2)

---

## File map

| File | Responsibility |
|------|----------------|
| `src-tauri/src/db.rs` | Migrate `deleted_at` + index |
| `src-tauri/src/documents.rs` | Soft/hard delete, restore, list trash, purge expired; filter active lists; reject read/save on trashed |
| `src-tauri/src/link_index.rs` | On hard purge, also delete inbound `target_id`; `needs_rebuild` count active docs only |
| `src-tauri/src/prefs/mod.rs` | `trash_retention_days` on `VaultUiState` |
| `src-tauri/src/commands.rs` + `lib.rs` | Register new commands |
| `src-tauri/src/mcp/handlers.rs` | HTTP routes for restore/list trash/purge/empty |
| `packages/lizhi-mcp/src/*` | Tools + backend methods; then `pnpm build:mcp && pnpm sync:lizhi-mcp` |
| `src/services/documentService.ts` | IPC + localStorage soft-delete fallback |
| `src/stores/documents.ts` | `remove` = soft; add `purge`; trash list helpers |
| `src/composables/useDocumentDelete.ts` | Soft + hard pending confirm state |
| `src/App.vue` | Two confirm dialogs (or one driven by mode) |
| `src/components/workspace/FolderTreeNode.vue` + `FolderTreeVirtualRow.vue` | Trash2 + XCircle side by side |
| `src/composables/useFolderContextMenu.ts` | Both menu items |
| `src/components/common/CommandPalette.vue` | Both commands |
| `src/stores/ui.ts` | `WorkspaceViewMode` += `"trash"` |
| `src/components/workspace/Sidebar.vue` | Trash entry + badge |
| `src/components/workspace/TrashPanel.vue` | **Create** list / restore / purge / empty |
| `src/views/WorkspaceView.vue` | Render `TrashPanel` when mode is trash |
| `src/views/SettingsView.vue` + `settingsSections.ts` | Retention days control |
| `src/utils/aiWriteTools.ts` + `chatToolDisplay.ts` | New MCP tool display names |
| Unlock / vault init path in frontend | Call `purge_expired_documents` after unlock |

---

### Task 1: Schema migration `deleted_at`

**Files:**
- Modify: `src-tauri/src/db.rs` (`migrate_documents_columns`)
- Modify: `src-tauri/src/documents.rs` (`DocumentMeta`)

- [ ] **Step 1: Extend migration**

In `migrate_documents_columns`, after `word_count` block:

```rust
    if !cols.iter().any(|c| c == "deleted_at") {
        conn.execute("ALTER TABLE documents ADD COLUMN deleted_at INTEGER NULL", [])?;
    }
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at)",
        [],
    )?;
```

- [ ] **Step 2: Extend `DocumentMeta`**

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentMeta {
    pub id: String,
    pub title: String,
    pub path: String,
    pub folder: String,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<i64>,
}
```

Update every `DocumentMeta { ... }` construction and every `SELECT id, title, path, folder, created_at, updated_at` that feeds `DocumentMeta` to include `deleted_at` (use `row.get::<_, Option<i64>>(...)`).

For **active** list helpers, do not populate trash rows (next task). Meta returned from create/save/restore may set `deleted_at: None`.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db.rs src-tauri/src/documents.rs
git commit -m "feat(vault): add documents.deleted_at for trash"
```

---

### Task 2: Soft delete, purge, restore, list trash (Rust + unit tests)

**Files:**
- Modify: `src-tauri/src/documents.rs`
- Modify: `src-tauri/src/link_index.rs`

- [ ] **Step 1: Add inbound link cleanup helper**

In `link_index.rs`:

```rust
pub fn remove_all_links_for_document(conn: &Connection, document_id: &str) -> Result<(), AppError> {
    remove_links_for_document(conn, document_id)?;
    ensure_links_schema(conn)?;
    conn.execute(
        "DELETE FROM document_links WHERE target_id = ?1",
        params![document_id],
    )?;
    Ok(())
}
```

Update `needs_rebuild` doc count:

```rust
let doc_count: i64 = conn.query_row(
    "SELECT count(*) FROM documents WHERE deleted_at IS NULL",
    [],
    |row| row.get(0),
)?;
```

- [ ] **Step 2: Write failing unit tests** in `documents.rs` `#[cfg(test)] mod tests`

Pattern (same as `journal.rs` tests: `db::init` + `connect_plaintext`):

```rust
#[cfg(test)]
mod trash_tests {
    use super::*;
    use crate::db;
    use std::env;
    use std::fs;
    use std::path::PathBuf;

    fn test_service() -> (DocumentService, PathBuf) {
        let dir = env::temp_dir().join(format!("lizhi-trash-test-{}", Uuid::new_v4()));
        db::init(&dir).unwrap();
        let mut svc = DocumentService::new(dir.clone());
        svc.connect_plaintext().unwrap();
        (svc, dir)
    }

    #[test]
    fn soft_delete_hides_from_list_keeps_file() {
        let (mut svc, dir) = test_service();
        let meta = svc
            .create_document("回收站测".into(), Some("inbox".into()), None)
            .unwrap();
        let path = db::workspace_dir(&dir).join("inbox").join(format!("{}.md", meta.id));
        assert!(path.is_file());
        svc.delete_document(&meta.id).unwrap();
        assert!(svc.list_documents().unwrap().is_empty());
        assert_eq!(svc.list_trashed_documents().unwrap().len(), 1);
        assert!(path.is_file());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn restore_returns_to_list() {
        let (mut svc, dir) = test_service();
        let meta = svc
            .create_document("恢复测".into(), Some("inbox".into()), None)
            .unwrap();
        svc.delete_document(&meta.id).unwrap();
        let restored = svc.restore_document(&meta.id).unwrap();
        assert!(restored.deleted_at.is_none());
        assert_eq!(svc.list_documents().unwrap().len(), 1);
        assert!(svc.list_trashed_documents().unwrap().is_empty());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn purge_removes_file_and_row() {
        let (mut svc, dir) = test_service();
        let meta = svc
            .create_document("硬删测".into(), Some("inbox".into()), None)
            .unwrap();
        let path = db::workspace_dir(&dir).join("inbox").join(format!("{}.md", meta.id));
        svc.purge_document(&meta.id).unwrap();
        assert!(svc.list_documents().unwrap().is_empty());
        assert!(svc.list_trashed_documents().unwrap().is_empty());
        assert!(!path.exists());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn purge_expired_respects_retention() {
        let (mut svc, dir) = test_service();
        let old = svc
            .create_document("过期".into(), Some("inbox".into()), None)
            .unwrap();
        let fresh = svc
            .create_document("未过期".into(), Some("inbox".into()), None)
            .unwrap();
        svc.delete_document(&old.id).unwrap();
        svc.delete_document(&fresh.id).unwrap();
        let forty_days_ms = 40_i64 * 24 * 60 * 60 * 1000;
        let old_ts = now_millis() - forty_days_ms;
        svc.conn_mut()
            .unwrap()
            .execute(
                "UPDATE documents SET deleted_at = ?1 WHERE id = ?2",
                rusqlite::params![old_ts, old.id],
            )
            .unwrap();
        let purged = svc.purge_expired_documents(30).unwrap();
        assert_eq!(purged, 1);
        let trash = svc.list_trashed_documents().unwrap();
        assert_eq!(trash.len(), 1);
        assert_eq!(trash[0].id, fresh.id);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn restore_rejects_active_document() {
        let (mut svc, dir) = test_service();
        let meta = svc
            .create_document("活跃".into(), Some("inbox".into()), None)
            .unwrap();
        let err = svc.restore_document(&meta.id).unwrap_err();
        assert!(format!("{err}").contains("回收站"));
        let _ = fs::remove_dir_all(dir);
    }
}
```

Confirm the timestamp helper name is `now_millis` (already used in `create_document`).

- [ ] **Step 3: Run tests — expect FAIL**

```bash
cd src-tauri && cargo test trash_tests -- --nocapture
```

Expected: compile errors or assertion failures (methods missing).

- [ ] **Step 4: Implement core methods**

Rename current hard-delete body to private `hard_delete_document(&mut self, id: &str)` using `link_index::remove_all_links_for_document` + FTS remove + `DELETE FROM documents` + `fs::remove_file` + clear tags via prefs if that API exists from Rust (`set_document_tags` empty / delete key). If tags cleanup is only on frontend today, add Rust cleanup in purge via `prefs::set_document_tags(data_dir, id, &[])` or delete map entry — follow existing `set_document_tags` signature.

```rust
fn load_meta(conn: &Connection, id: &str) -> Result<DocumentMeta, AppError> {
    conn.query_row(
        "SELECT id, title, path, folder, created_at, updated_at, deleted_at FROM documents WHERE id = ?1",
        params![id],
        |row| {
            Ok(DocumentMeta {
                id: row.get(0)?,
                title: row.get(1)?,
                path: row.get(2)?,
                folder: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                deleted_at: row.get(6)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::DocumentNotFound(id.to_string()))
}

pub fn delete_document(&mut self, id: &str) -> Result<(), AppError> {
    let _ = self.get_document_location(id)?;
    let now = now_millis();
    let updated = self.conn_mut()?.execute(
        "UPDATE documents SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, id],
    )?;
    if updated == 0 {
        return Ok(()); // already trashed — idempotent
    }
    if let Ok(conn) = self.conn() {
        search_index::remove_document(conn, id)?;
        link_index::remove_links_for_document(conn, id)?;
    }
    Ok(())
}

pub fn restore_document(&mut self, id: &str) -> Result<DocumentMeta, AppError> {
    let meta = load_meta(self.conn()?, id)?;
    if meta.deleted_at.is_none() {
        return Err(AppError::InvalidAssetId("文档不在回收站".into())); // or dedicated AppError variant with Display 中文
    }
    self.conn_mut()?.execute(
        "UPDATE documents SET deleted_at = NULL WHERE id = ?1",
        params![id],
    )?;
    let _ = crate::prefs::ensure_folder_path(&self.data_dir, &meta.folder);
    let content = self.read_content(&meta.folder, id, None)?; // match existing read_content signature incl. dek
    self.index_document(id, &meta.title, &content, &[])?;
    // also re-run link_index upsert used by save_document — copy that call site
    load_meta(self.conn()?, id)
}

pub fn purge_document(&mut self, id: &str) -> Result<(), AppError> {
    self.hard_delete_document(id)
}

pub fn list_trashed_documents(&self) -> Result<Vec<DocumentMeta>, AppError> {
    let mut stmt = self.conn()?.prepare(
        "SELECT id, title, path, folder, created_at, updated_at, deleted_at
         FROM documents WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(DocumentMeta {
            id: row.get(0)?,
            title: row.get(1)?,
            path: row.get(2)?,
            folder: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            deleted_at: row.get(6)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn empty_trash(&mut self) -> Result<u32, AppError> {
    let ids: Vec<String> = self
        .list_trashed_documents()?
        .into_iter()
        .map(|m| m.id)
        .collect();
    let mut n = 0u32;
    for id in ids {
        self.hard_delete_document(&id)?;
        n += 1;
    }
    Ok(n)
}

pub fn purge_expired_documents(&mut self, retention_days: u32) -> Result<u32, AppError> {
    let days = retention_days.clamp(1, 365) as i64;
    let cutoff = now_millis() - days * 24 * 60 * 60 * 1000;
    let mut stmt = self.conn()?.prepare(
        "SELECT id FROM documents WHERE deleted_at IS NOT NULL AND deleted_at <= ?1",
    )?;
    let ids: Vec<String> = stmt
        .query_map(params![cutoff], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    let mut n = 0u32;
    for id in ids {
        self.hard_delete_document(&id)?;
        n += 1;
    }
    Ok(n)
}
```

In `hard_delete_document`, after DB/file cleanup call `crate::prefs::set_document_tags(&self.data_dir, id, &[])` (ignore error or map to AppError). Prefer a small `AppError` message type that surfaces 「文档不在回收站」/「文档在回收站中，请先恢复」 to the IPC string layer — match how other user-facing errors are mapped in `commands.rs`.

Change `list_documents` SQL to:

```sql
SELECT id, title, path, folder, created_at, updated_at, deleted_at
FROM documents
WHERE deleted_at IS NULL
ORDER BY updated_at DESC
```

Apply the same `WHERE deleted_at IS NULL` to dashboard counts, graph source lists, and any internal `SELECT ... FROM documents` that means “active” (grep in `documents.rs`, `link_index.rs`, `ai/rag.rs` paths that call `list_documents` — filtering list_documents covers most).

`get_document` / `read_document` / `save_document`: if `deleted_at IS NOT NULL`, return `AppError` with Chinese message 「文档在回收站中，请先恢复」.

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd src-tauri && cargo test trash_tests -- --nocapture
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/documents.rs src-tauri/src/link_index.rs
git commit -m "feat(vault): soft-delete, restore, and purge documents"
```

---

### Task 3: Retention prefs + Tauri commands

**Files:**
- Modify: `src-tauri/src/prefs/mod.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add field to `VaultUiState`**

```rust
    #[serde(default = "default_trash_retention_days")]
    pub trash_retention_days: u32,

fn default_trash_retention_days() -> u32 { 30 }
```

Update `Default` impl / merge if needed so missing field → 30.

- [ ] **Step 2: Commands**

```rust
#[tauri::command]
pub fn restore_document(state: State<Arc<AppState>>, id: String) -> Result<DocumentMeta, String> { ... }

#[tauri::command]
pub fn purge_document(state: State<Arc<AppState>>, id: String) -> Result<(), String> { ... }

#[tauri::command]
pub fn list_trashed_documents(state: State<Arc<AppState>>) -> Result<Vec<DocumentMeta>, String> { ... }

#[tauri::command]
pub fn empty_trash(state: State<Arc<AppState>>) -> Result<u32, String> { ... }

#[tauri::command]
pub fn purge_expired_documents(state: State<Arc<AppState>>) -> Result<u32, String> {
    let days = crate::prefs::load_ui_state(&data_dir)?.trash_retention_days;
    // clamp 1..=365
    service.purge_expired_documents(days).map_err(...)
}

#[tauri::command]
pub fn get_trash_retention_days() -> Result<u32, String> { ... }

#[tauri::command]
pub fn set_trash_retention_days(days: u32) -> Result<u32, String> {
    let days = days.clamp(1, 365);
    let mut state = load_ui_state(...)?;
    state.trash_retention_days = days;
    save_ui_state(...)?;
    Ok(days)
}
```

Keep `delete_document` command name; body now soft-deletes.

Register all in `lib.rs` invoke handler.

- [ ] **Step 3: `cargo check` in `src-tauri`**

Expected: success (warnings zero for changed code).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/prefs/mod.rs src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): expose trash restore/purge/retention commands"
```

---

### Task 4: MCP tools + HTTP handlers

**Files:**
- Modify: `src-tauri/src/mcp/handlers.rs`
- Modify: `packages/lizhi-mcp/src/types.ts`
- Modify: `packages/lizhi-mcp/src/httpBackend.ts`
- Modify: `packages/lizhi-mcp/src/tools.ts`
- Modify: `src/utils/aiWriteTools.ts`
- Modify: `src/utils/chatToolDisplay.ts`

- [ ] **Step 1: HTTP routes** (mirror existing document routes style)

| Method | Path | Behavior |
|--------|------|----------|
| `DELETE` | `/documents/:id` | soft delete (existing; response can stay `{ deleted }` or add `{ trashed }`) |
| `POST` | `/documents/:id/restore` | restore |
| `DELETE` | `/documents/:id/purge` | hard purge |
| `GET` | `/documents/trashed` | list trash (**register before** `/:id` catch-alls if any) |
| `DELETE` | `/documents/trash` | empty trash |

All writes: `ensure_write_enabled`.

- [ ] **Step 2: MCP tools**

```ts
{
  name: "lizhi_delete_document",
  description: "将文档移至回收站（软删除，需 MCP 写入）",
  schema: { id: z.string() },
  run: ({ id }) => wrap(() => backend.deleteDocument(String(id))),
},
{
  name: "lizhi_restore_document",
  description: "从回收站恢复文档（需 MCP 写入）",
  schema: { id: z.string() },
  run: ({ id }) => wrap(() => backend.restoreDocument(String(id))),
},
{
  name: "lizhi_list_trashed_documents",
  description: "列出回收站中的文档",
  schema: {},
  run: () => wrap(() => backend.listTrashedDocuments()),
},
{
  name: "lizhi_purge_document",
  description: "永久删除文档（不可恢复；活跃或回收站均可；需 MCP 写入）",
  schema: { id: z.string() },
  run: ({ id }) => wrap(() => backend.purgeDocument(String(id))),
},
{
  name: "lizhi_empty_trash",
  description: "清空回收站（永久删除全部回收站文档，不可恢复；需 MCP 写入）",
  schema: {},
  run: () => wrap(() => backend.emptyTrash()),
},
```

Extend `DocumentBackend` interface in `types.ts` / `httpBackend.ts` accordingly.

- [ ] **Step 3: Frontend tool labels**

Add `lizhipurgedocument`, `lizhirestoredocument`, `lizhiemptytrash` to write allowlist where appropriate (`empty`/`purge`/`restore` are writes; `list` is not). Display names in 中文.

- [ ] **Step 4: Build + sync MCP**

```bash
pnpm build:mcp && pnpm sync:lizhi-mcp
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/mcp/handlers.rs packages/lizhi-mcp src/utils/aiWriteTools.ts src/utils/chatToolDisplay.ts src-tauri/resources
git commit -m "feat(mcp): trash soft-delete, restore, purge, empty"
```

---

### Task 5: Frontend service + documents store

**Files:**
- Modify: `src/services/documentService.ts` (and localStorage helpers)
- Modify: `src/stores/documents.ts`
- Modify: frontend `DocumentMeta` type if separate

- [ ] **Step 1: Types**

```ts
export interface DocumentMeta {
  id: string;
  title: string;
  path: string;
  folder: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}
```

- [ ] **Step 2: Service APIs**

```ts
export async function deleteDocument(id: string): Promise<void> { /* soft via delete_document */ }
export async function purgeDocument(id: string): Promise<void> {
  return invokeBackend("purge_document", { id }, () => localPurgeDocument(id));
}
export async function restoreDocument(id: string): Promise<DocumentMeta> { ... }
export async function listTrashedDocuments(): Promise<DocumentMeta[]> { ... }
export async function emptyTrash(): Promise<number> { ... }
export async function purgeExpiredDocuments(): Promise<number> { ... }
export async function getTrashRetentionDays(): Promise<number> { ... }
export async function setTrashRetentionDays(days: number): Promise<number> { ... }
```

Local fallback: store `deletedAt` on local document records; filter `list` / tree; implement purge as hard remove from localStorage.

- [ ] **Step 3: Store**

```ts
async function remove(id: string) {
  // existing body but calls soft deleteDocument
}

async function purge(id: string) {
  (await getLinksStore()).removeDocument(tree.value, id);
  await purgeDocument(id);
  // same tree/nav/pinned/active/folders cleanup as remove
  // also clear document tags for id
}

async function restoreFromTrash(id: string) {
  const meta = await restoreDocument(id);
  await fetchTree(); // or push meta into tree
  useFoldersStore(). /* ensure folder membership */ 
  return meta;
}
```

Expose trash list loading used by TrashPanel.

- [ ] **Step 4: Commit**

```bash
git add src/services/documentService.ts src/stores/documents.ts src/types
git commit -m "feat(fe): document service soft-delete and purge"
```

---

### Task 6: Dual confirm UX + tree / menu / palette

**Files:**
- Modify: `src/composables/useDocumentDelete.ts`
- Modify: `src/App.vue`
- Modify: `src/components/workspace/FolderTreeNode.vue`
- Modify: `src/components/workspace/FolderTreeVirtualRow.vue`
- Modify: `src/composables/useFolderContextMenu.ts`
- Modify: `src/components/common/CommandPalette.vue`
- Modify: pinned-docs row in `Sidebar.vue` if it should also allow delete (optional: only FolderTree rows — match spec “文档行”; pinned can open same tree actions later; if pinned has no trash today, skip)

- [ ] **Step 1: Composable**

```ts
type DeleteMode = "trash" | "purge";
const pending = ref<{ id: string; title: string; mode: DeleteMode } | null>(null);

function requestDelete(docId: string) { /* mode: 'trash' */ }
function requestPurge(docId: string) { /* mode: 'purge' */ }

async function confirmDelete() {
  if (!pending.value) return;
  const { id, mode } = pending.value;
  pending.value = null;
  if (mode === "purge") await documents.purge(id);
  else await documents.remove(id);
}
```

- [ ] **Step 2: App.vue dialogs**

Drive one `ConfirmDialog` from `pending.mode`:

- trash: title「移至回收站」, description 可恢复, confirm-label「移至回收站」, `destructive` optional false or true
- purge: title「永久删除」, description 不可恢复, confirm-label「永久删除」, `destructive`

- [ ] **Step 3: Tree row buttons**

Beside existing Trash2 (aria-label「移至回收站」), add XCircle button:

```vue
<button
  type="button"
  class="focus-ring hidden shrink-0 rounded p-0.5 text-muted hover:bg-surface-1 hover:text-danger group-hover/doc:inline-flex"
  aria-label="永久删除"
  title="永久删除"
  @click.stop="requestPurge(doc.id)"
>
  <XCircle :size="11" aria-hidden="true" />
</button>
```

Keep Trash2 → `requestDelete`. Mirror in virtual row + `useFolderTreeRow` if icons live there.

- [ ] **Step 4: Context menu + command palette**

Two items: 「移至回收站」, 「永久删除」(`danger: true`). Palette: 「移至回收站」/「永久删除当前文档」.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useDocumentDelete.ts src/App.vue src/components/workspace src/composables/useFolderContextMenu.ts src/components/common/CommandPalette.vue
git commit -m "feat(ui): trash and permanent-delete confirms on document tree"
```

---

### Task 7: Trash panel, sidebar entry, unlock purge

**Files:**
- Modify: `src/stores/ui.ts`, `src/utils/workspaceSession.ts`, `src/components/workspace/WorkspaceToolbar.vue` (do **not** add trash to edit/graph toggle; mode set only from sidebar)
- Create: `src/components/workspace/TrashPanel.vue`
- Modify: `src/components/workspace/Sidebar.vue`
- Modify: `src/views/WorkspaceView.vue`
- Modify: unlock success path (e.g. `src/stores/vault.ts` or `UnlockView.vue` — grep `unlock_vault` / `unlockVault` and call purge after success)

- [ ] **Step 1: View mode**

```ts
export type WorkspaceViewMode = "edit" | "graph" | "trash";
```

Normalize session restore: unknown → `"edit"`; allow `"trash"`.

Toolbar modes array stays edit/graph only. Selecting edit/graph clears trash mode as today.

- [ ] **Step 2: TrashPanel.vue**

On mount / activate:

1. `await purgeExpiredDocuments()`
2. `trashed = await listTrashedDocuments()`
3. Load retention days for “剩余天数” display: `ceil((deletedAt + days*86400000 - now) / 86400000)`

UI: list rows with restore + permanent delete; top「清空回收站」with confirm; empty state「回收站为空」. `data-testid="trash-panel"`.

- [ ] **Step 3: Sidebar footer**

Above or within bottom section (with 资产库), add:

```vue
<button
  type="button"
  class="..."
  data-testid="sidebar-trash"
  :aria-current="ui.workspaceViewMode === 'trash' ? 'page' : undefined"
  @click="ui.setWorkspaceView('trash')"
>
  <!-- Trash2 + 回收站 + optional count badge -->
</button>
```

Load trash count lazily (on mount / after delete) via `listTrashedDocuments().length` or a lightweight command later — for MVP list length is fine.

- [ ] **Step 4: WorkspaceView**

```vue
<TrashPanel v-if="ui.workspaceViewMode === 'trash'" />
<!-- existing edit/graph branches -->
```

- [ ] **Step 5: After unlock**

```ts
await purgeExpiredDocuments().catch(() => 0);
```

Do not block unlock UI on failure (toast optional).

- [ ] **Step 6: Commit**

```bash
git add src/stores/ui.ts src/utils/workspaceSession.ts src/components/workspace/TrashPanel.vue src/components/workspace/Sidebar.vue src/views/WorkspaceView.vue src/stores/vault.ts src/views/UnlockView.vue
git commit -m "feat(ui): recycle bin panel and auto-purge on unlock"
```

---

### Task 8: Settings — retention days

**Files:**
- Modify: `src/constants/settingsSections.ts`
- Modify: `src/views/SettingsView.vue` (or small panel component under `src/components/settings/`)

- [ ] **Step 1: Add section** `settings-trash` label「回收站」near folder-tree / security.

- [ ] **Step 2: Number input**

```vue
<label>回收站保留天数</label>
<input type="number" min="1" max="365" v-model.number="retentionDays" />
<button @click="save">保存</button>
<p class="text-muted text-xs">默认 30 天。到期后在解锁或打开回收站时自动永久删除。</p>
```

Load/save via `getTrashRetentionDays` / `setTrashRetentionDays`. Clamp 1–365 before save.

- [ ] **Step 3: Commit**

```bash
git add src/constants/settingsSections.ts src/views/SettingsView.vue src/components/settings
git commit -m "feat(settings): trash retention days"
```

---

### Task 9: Verify + optional E2E

**Files:**
- Optional: `tests/e2e/` new or extend existing workspace test

- [ ] **Step 1: Run verify**

```bash
pnpm verify
```

Expected: pass, zero warnings on project sources.

- [ ] **Step 2: Manual smoke** (if e2e skipped)

1. Create doc → 移至回收站 → disappears from tree → in trash  
2. Restore → back in folder  
3. Tree XCircle → 永久删除 → gone from trash too  
4. Change retention to 1; manually age `deleted_at` in DB or wait — unlock purges  

- [ ] **Step 3: E2E (preferred if Playwright helpers exist for vault)**

Flow: delete → open trash → restore. Use `data-testid`s: `delete-document-dialog`, `sidebar-trash`, `trash-panel`.

- [ ] **Step 4: Final commit**

```bash
git add tests/e2e
git commit -m "test(e2e): document trash restore flow"
```

(Skip commit if no e2e file added.)

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `deleted_at` soft delete | 1–2 |
| Active query filter | 2 |
| restore / purge / list / empty / purge_expired | 2–3 |
| Retention in vault-ui-state, default 30, clamp 1–365 | 3, 8 |
| Unlock + open trash purge | 7 |
| MCP soft delete + purge + restore + list + empty | 4 |
| Reject read/save on trashed | 2 |
| Sidebar trash + TrashPanel | 7 |
| Tree Trash2 + XCircle side by side | 6 |
| Dual confirm copy | 6 |
| Settings retention | 8 |
| Tags keep on soft / clear on purge | 2 (Rust) + 5 (FE) |
| Inbound link cleanup on hard purge | 2 |
| Browser fallback | 5 |
| `pnpm verify` | 9 |
| YAGNI: no in-trash editor / drag-to-trash | — |

---

## Out of scope (do not implement)

- Recycle-bin document preview/editor  
- Drag document into trash  
- MCP tools for retention days  
- Background timer daemon  
