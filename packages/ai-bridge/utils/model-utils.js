/**
 * Map UI / gateway model id to Claude SDK short selector (sonnet | opus | haiku).
 * API model names come from ANTHROPIC_DEFAULT_*_MODEL env vars.
 *
 * @param {string | null | undefined} modelId
 * @returns {"sonnet" | "opus" | "haiku"}
 */
export function mapModelIdToSdkName(modelId) {
  if (!modelId || typeof modelId !== "string") {
    return "sonnet";
  }
  const lower = modelId.toLowerCase();
  if (lower.includes("opus")) return "opus";
  if (lower.includes("haiku")) return "haiku";
  return "sonnet";
}

/**
 * @param {string | null | undefined} slot
 * @returns {slot is "sonnet" | "opus" | "haiku"}
 */
export function isModelSlot(slot) {
  return slot === "sonnet" || slot === "opus" || slot === "haiku";
}

/**
 * @param {string | null | undefined} selectedModel
 * @param {string | null | undefined} selectedModelSlot
 */
export function resolveSdkModelName(selectedModel, selectedModelSlot) {
  if (isModelSlot(selectedModelSlot)) {
    return selectedModelSlot;
  }
  return mapModelIdToSdkName(selectedModel);
}

/**
 * Resolve gateway model id for API calls from UI selection + provider defaults.
 *
 * @param {string | null | undefined} selectedModel
 * @param {string | null | undefined} selectedModelSlot
 * @param {{ model?: string | null, sonnetModel?: string | null, opusModel?: string | null, fastModel?: string | null }} providerModels
 */
export function resolveProviderApiModel(selectedModel, selectedModelSlot, providerModels) {
  const selected = String(selectedModel ?? "").trim();
  if (selected) return selected;

  const slot = isModelSlot(selectedModelSlot)
    ? selectedModelSlot
    : mapModelIdToSdkName(selectedModel);
  const fallback = String(providerModels?.model ?? "").trim();
  switch (slot) {
    case "opus":
      return String(providerModels?.opusModel ?? "").trim() || fallback;
    case "haiku":
      return String(providerModels?.fastModel ?? "").trim() || fallback;
    default:
      return String(providerModels?.sonnetModel ?? "").trim() || fallback;
  }
}

/**
 * Write SDK model routing vars to process.env (CC GUI pattern).
 * Mutates process.env — safe for single-request bridge architecture.
 *
 * @param {string} resolvedModelId
 * @param {string | null | undefined} baseModelId
 */
export function setModelEnvironmentVariables(resolvedModelId, baseModelId) {
  if (!resolvedModelId || typeof resolvedModelId !== "string") {
    return;
  }

  const lowerBase = String(baseModelId || resolvedModelId).toLowerCase();
  process.env.ANTHROPIC_MODEL = resolvedModelId;

  if (lowerBase.includes("opus")) {
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = resolvedModelId;
  } else if (lowerBase.includes("haiku")) {
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = resolvedModelId;
    process.env.ANTHROPIC_SMALL_FAST_MODEL = resolvedModelId;
  } else {
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = resolvedModelId;
  }
}
