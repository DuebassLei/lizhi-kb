import {
  getCcWorkbenchStatus,
  previewClaudeLocalSettings,
  switchCcProvider,
  LOCAL_SETTINGS_PROVIDER_ID,
  type CcWorkbenchConfigPublic,
} from "../../services/ccWorkbenchService";
import { useUiStore } from "../../stores/ui";

export async function activateCcProvider(
  id: string,
): Promise<CcWorkbenchConfigPublic | null> {
  const ui = useUiStore();

  if (id === LOCAL_SETTINGS_PROVIDER_ID) {
    try {
      const preview = await previewClaudeLocalSettings();
      if (!preview.exists) {
        ui.showToast("error", "未找到 ~/.claude/settings.json，请先配置 Claude Code");
        return null;
      }
      if (!preview.apiKeyMasked) {
        ui.showToast(
          "error",
          "settings.json 中未配置 ANTHROPIC_AUTH_TOKEN 或 ANTHROPIC_API_KEY",
        );
        return null;
      }
      if (
        !confirm(
          `将使用本地 settings.json 中的环境变量（${preview.path}）。\n\n确认启用？`,
        )
      ) {
        return null;
      }
    } catch (e) {
      ui.showToast("error", e instanceof Error ? e.message : "读取 settings.json 失败");
      return null;
    }
  }

  try {
    const config = await switchCcProvider(id);
    await getCcWorkbenchStatus();
    return config;
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "切换失败");
    return null;
  }
}

export function providerModeLabel(mode: string, source?: string | null): string {
  if (source === "local_settings") return "本地 settings.json";
  if (mode === "official") return "官方";
  return "自定义";
}
