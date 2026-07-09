import type { EditorView } from "@codemirror/view";
import { saveAsset } from "../services/assetService";
import { insertAtCursor } from "./markdownInsert";

function imageAltFromFile(file: File): string {
  const base = file.name.replace(/\.[^/.]+$/, "").trim();
  return base || "图片";
}

export function extractClipboardImage(data: DataTransfer | null): File | null {
  if (!data) return null;

  for (const item of data.items) {
    if (item.kind !== "file") continue;
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  for (const file of data.files) {
    if (file.type.startsWith("image/")) return file;
  }

  return null;
}

export async function insertImageFromFile(view: EditorView, file: File): Promise<void> {
  const ref = await saveAsset(file);
  const alt = imageAltFromFile(file);
  insertAtCursor(view, `![${alt}](${ref})`);
}
