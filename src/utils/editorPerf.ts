import { shallowRef } from "vue";

/** 编辑链路 Performance 标记与可读 HUD（仅 DEV） */

const ENABLED = import.meta.env.DEV;

export type EditorPerfSnapshot = {
  contentUpdateMs: number | null;
  previewHtmlMs: number | null;
  previewWechatMs: number | null;
  autosaveMs: number | null;
  updatedAt: number;
};

const empty: EditorPerfSnapshot = {
  contentUpdateMs: null,
  previewHtmlMs: null,
  previewWechatMs: null,
  autosaveMs: null,
  updatedAt: 0,
};

/** DEV HUD 订阅用 */
export const editorPerfSnapshot = shallowRef<EditorPerfSnapshot>({ ...empty });

function record(partial: Partial<EditorPerfSnapshot>) {
  if (!ENABLED) return;
  editorPerfSnapshot.value = {
    ...editorPerfSnapshot.value,
    ...partial,
    updatedAt: Date.now(),
  };
}

export function editorPerfMark(name: string): void {
  if (!ENABLED || typeof performance === "undefined") return;
  try {
    performance.mark(name);
  } catch {
    /* ignore */
  }
}

export function editorPerfMeasure(name: string, startMark: string, endMark: string): void {
  if (!ENABLED || typeof performance === "undefined") return;
  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name, "measure");
    const last = entries[entries.length - 1];
    if (!last) return;
    const ms = Math.round(last.duration);
    if (name === "editor:content-update") record({ contentUpdateMs: ms });
    else if (name === "preview:html-render") record({ previewHtmlMs: ms });
    else if (name === "preview:wechat-render") record({ previewWechatMs: ms });
    else if (name === "autosave:ipc") record({ autosaveMs: ms });
  } catch {
    /* ignore */
  }
}

/** 在 requestIdleCallback（或 setTimeout）中跑非关键收尾 */
export function runWhenIdle(task: () => void, timeoutMs = 2000): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => task(), { timeout: timeoutMs });
    return;
  }
  setTimeout(task, 0);
}

/** 控制台一眼可读（可选） */
export function logEditorPerfHint(): void {
  if (!ENABLED) return;
  const s = editorPerfSnapshot.value;
  // eslint-disable-next-line no-console
  console.info(
    "[编辑性能]",
    `Pinia ${s.contentUpdateMs ?? "—"}ms`,
    `GFM预览 ${s.previewHtmlMs ?? "—"}ms`,
    `公众号 ${s.previewWechatMs ?? "—"}ms`,
    `自动保存 ${s.autosaveMs ?? "—"}ms`,
  );
}
