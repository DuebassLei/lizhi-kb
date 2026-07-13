import {
  cloneDefaultTemplates,
  mergeMissingDefaultTemplates,
  normalizeTemplateList,
  type DocTemplateConfig,
} from "./documentTemplates";

export const DOC_TEMPLATES_STORAGE_KEY = "lizhi-kb-doc-templates";

export function loadStoredDocumentTemplates(): DocTemplateConfig[] {
  try {
    const raw = localStorage.getItem(DOC_TEMPLATES_STORAGE_KEY);
    if (!raw) return cloneDefaultTemplates();
    const normalized = normalizeTemplateList(JSON.parse(raw) as unknown);
    const merged = mergeMissingDefaultTemplates(normalized);
    if (merged.length !== normalized.length) {
      saveDocumentTemplatesToStorage(merged);
    }
    return merged;
  } catch {
    return cloneDefaultTemplates();
  }
}

export function saveDocumentTemplatesToStorage(templates: DocTemplateConfig[]): void {
  try {
    localStorage.setItem(DOC_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    /* ignore */
  }
}
