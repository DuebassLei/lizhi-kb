import type { EditorMode, WorkspaceViewMode } from "../stores/ui";

const SESSION_KEY = "lizhi-kb-session";

export interface WorkspaceSession {
  activeId: string | null;
  workspaceViewMode: WorkspaceViewMode;
  editorMode: EditorMode;
}

const DEFAULT: WorkspaceSession = {
  activeId: null,
  workspaceViewMode: "edit",
  editorMode: "edit",
};

function normalizeEditorMode(raw: unknown): EditorMode {
  if (raw === "preview") return "preview";
  if (raw === "edit" || raw === "wysiwyg" || raw === "source") return "edit";
  return "edit";
}

export function loadWorkspaceSession(): WorkspaceSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<WorkspaceSession>;
    const viewMode = parsed.workspaceViewMode;
    const normalizedViewMode: WorkspaceViewMode =
      viewMode === "edit" ||
      viewMode === "graph" ||
      viewMode === "mindmap" ||
      viewMode === "trash"
        ? viewMode
        : "edit";
    return {
      activeId: parsed.activeId ?? null,
      workspaceViewMode: normalizedViewMode,
      editorMode: normalizeEditorMode(parsed.editorMode),
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveWorkspaceSession(session: WorkspaceSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
