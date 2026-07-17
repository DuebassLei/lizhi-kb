import { getAiConfig, type CloudProviderPublic } from "./aiService";
import { isTauriRuntime } from "./vaultService";

export interface GenerateImageOpts {
  prompt: string;
  /** OpenAI size string；缺省 1792x768（接近 2.35:1） */
  size?: string;
  /** 覆盖配置中的 imageModel */
  model?: string;
  /** 指定云端提供商 id；缺省自动挑选有图片模型的 */
  providerId?: string;
}

export interface ImageEndpoint {
  providerId: string;
  providerName: string;
  baseUrl: string;
  apiKey: string;
  imageModel: string;
}

/** 封面生图默认尺寸（约 2.33:1，接近公众号 2.35:1） */
export const WA_COVER_AI_SIZE = "1792x768";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function hasImageModel(p: CloudProviderPublic): boolean {
  return p.enabled !== false && Boolean((p.imageModel ?? "").trim());
}

/**
 * 挑选文生图提供商：显式 id > active 且已配 imageModel > 任意已配 imageModel
 * （避免 active 仅有对话模型时把其它生图配置挡死）
 */
export function pickImageProvider(
  providers: CloudProviderPublic[],
  opts?: { providerId?: string; activeId?: string | null },
): CloudProviderPublic | null {
  const enabled = providers.filter((p) => p.enabled !== false);
  if (opts?.providerId) {
    const hit = enabled.find((p) => p.id === opts.providerId && hasImageModel(p));
    if (hit) return hit;
  }
  if (opts?.activeId) {
    const active = enabled.find((p) => p.id === opts.activeId && hasImageModel(p));
    if (active) return active;
  }
  return enabled.find((p) => hasImageModel(p)) ?? null;
}

/** 解析当前可用的文生图端点；未配置则返回 null */
export async function resolveImageEndpoint(
  providerId?: string,
): Promise<ImageEndpoint | null> {
  if (!isTauriRuntime()) return null;
  const config = await getAiConfig(true);
  if (!config.cloudEnabled || config.cloudProviders.length === 0) return null;

  const pick = pickImageProvider(config.cloudProviders, {
    providerId,
    activeId: config.activeCloudProviderId,
  });
  if (!pick) return null;

  const imageModel = (pick.imageModel ?? "").trim();
  const apiKey = (pick.apiKey ?? "").trim();
  if (!imageModel || !apiKey) return null;

  return {
    providerId: pick.id,
    providerName: pick.name,
    baseUrl: normalizeBaseUrl(pick.baseUrl),
    apiKey,
    imageModel,
  };
}

export function hasImageModelConfigured(providers: CloudProviderPublic[]): boolean {
  return providers.some((p) => hasImageModel(p));
}

function b64ToBlob(b64: string, mime = "image/png"): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function parseGenerationsResponse(res: Response): Promise<Blob> {
  if (!res.ok) {
    let detail = "";
    try {
      const errJson = (await res.json()) as { error?: { message?: string } };
      detail = errJson.error?.message ?? "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(
      detail
        ? `文生图失败（${res.status}）：${detail}`
        : `文生图失败（HTTP ${res.status}）`,
    );
  }

  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = json.data?.[0];
  if (!item) throw new Error("文生图返回为空");

  if (item.b64_json) return b64ToBlob(item.b64_json);
  if (item.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error("下载生成图片失败");
    return imgRes.blob();
  }
  throw new Error("文生图返回缺少 b64_json / url");
}

/**
 * OpenAI 兼容 POST /images/generations
 * 先尝试 b64_json；若提供商拒收 response_format 则降级重试
 */
export async function generateImage(opts: GenerateImageOpts): Promise<Blob> {
  const endpoint = await resolveImageEndpoint(opts.providerId);
  if (!endpoint) {
    throw new Error("未配置图片模型：请到设置 →「AI 助手」→ 云端提供商中填写「图片模型」");
  }

  const model = (opts.model ?? endpoint.imageModel).trim();
  const size = opts.size ?? WA_COVER_AI_SIZE;
  const url = `${endpoint.baseUrl}/images/generations`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${endpoint.apiKey}`,
  };

  const attempt = async (withResponseFormat: boolean) => {
    const body: Record<string, unknown> = {
      model,
      prompt: opts.prompt,
      n: 1,
      size,
    };
    if (withResponseFormat) body.response_format = "b64_json";
    return fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  };

  let res = await attempt(true);
  if (!res.ok) {
    const cloned = res.clone();
    let detail = "";
    try {
      const errJson = (await cloned.json()) as { error?: { message?: string } };
      detail = (errJson.error?.message ?? "").toLowerCase();
    } catch {
      detail = (await res.clone().text().catch(() => "")).toLowerCase();
    }
    const formatRejected =
      detail.includes("response_format") ||
      detail.includes("b64_json") ||
      detail.includes("unknown parameter") ||
      res.status === 400;
    if (formatRejected) {
      res = await attempt(false);
    }
  }

  return parseGenerationsResponse(res);
}
