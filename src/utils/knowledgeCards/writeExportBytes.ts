import { isTauriRuntime } from "../../services/vaultService";
import { tauriInvoke } from "../../composables/useTauriCommand";

export async function saveBytesWithDialog(
  bytes: Uint8Array,
  defaultFilename: string,
  filters: { name: string; extensions: string[] }[],
): Promise<boolean> {
  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const dest = await save({
      title: "导出知识卡片",
      defaultPath: defaultFilename,
      filters,
    });
    if (!dest) return false;
    await tauriInvoke("write_export_binary", {
      path: dest,
      content: Array.from(bytes),
    });
    return true;
  }

  // Browser fallback
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFilename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}
