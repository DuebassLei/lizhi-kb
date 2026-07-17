import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "./vaultService";
import {
  WA_BUILTIN_STYLE_PACKS,
  mergeStylePacks,
} from "../utils/writingAssistant/stylePacks";
import type { WaStylePack, WaStylePackWrite } from "../utils/writingAssistant/stylePacks/types";

interface VaultStyleDto {
  id: string;
  label: string;
  hint: string;
  wordRange?: string;
  order: number;
  body: string;
}

function dtoToPack(d: VaultStyleDto): WaStylePack {
  return {
    id: d.id,
    label: d.label,
    hint: d.hint,
    wordRange: d.wordRange,
    order: d.order,
    promptMarkdown: d.body,
    source: "vault",
    hasBuiltin: false,
  };
}

/** 合并内置 + vault 风格包；浏览器模式仅内置 */
export async function loadMergedStylePacks(): Promise<WaStylePack[]> {
  if (!isTauriRuntime()) {
    return WA_BUILTIN_STYLE_PACKS.map((p) => ({ ...p }));
  }
  try {
    const vault = await tauriInvoke<VaultStyleDto[]>("list_writing_style_packs");
    return mergeStylePacks(vault.map(dtoToPack));
  } catch {
    return WA_BUILTIN_STYLE_PACKS.map((p) => ({ ...p }));
  }
}

export async function saveStylePack(pack: WaStylePackWrite): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("风格落盘需在桌面应用中使用");
  }
  await tauriInvoke("save_writing_style_pack", { pack });
}

export async function deleteStylePack(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("风格落盘需在桌面应用中使用");
  }
  await tauriInvoke("delete_writing_style_pack", { id });
}

export async function resetStylePack(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("风格落盘需在桌面应用中使用");
  }
  await tauriInvoke("reset_writing_style_pack", { id });
}
