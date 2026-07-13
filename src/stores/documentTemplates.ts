import { defineStore } from "pinia";
import { ref } from "vue";
import {
  buildTemplateContent,
  cloneDefaultTemplates,
  defaultTemplateId,
  sanitizeTemplateId,
  type DocTemplateConfig,
} from "../utils/documentTemplates";
import {
  loadStoredDocumentTemplates,
  saveDocumentTemplatesToStorage,
} from "../utils/documentTemplateSetting";
import { schedulePersistVaultUiState } from "../services/vaultUiStateService";

export const useDocumentTemplatesStore = defineStore("documentTemplates", () => {
  const templates = ref<DocTemplateConfig[]>(loadStoredDocumentTemplates());

  function persist() {
    saveDocumentTemplatesToStorage(templates.value);
    schedulePersistVaultUiState();
  }

  function hydrate(list: DocTemplateConfig[]) {
    templates.value = list;
  }

  function resetDefaults() {
    templates.value = cloneDefaultTemplates();
    persist();
  }

  function updateTemplate(id: string, patch: Partial<Omit<DocTemplateConfig, "id">>) {
    const index = templates.value.findIndex((item) => item.id === id);
    if (index < 0) return;
    const current = templates.value[index]!;
    templates.value[index] = {
      ...current,
      label: patch.label !== undefined ? patch.label.trim() || current.label : current.label,
      description:
        patch.description !== undefined ? patch.description.trim() : current.description,
      content:
        patch.content !== undefined && patch.content.trim()
          ? patch.content
          : patch.content !== undefined
            ? `# {{title}}\n\n`
            : current.content,
    };
    persist();
  }

  function addTemplate(partial?: Partial<DocTemplateConfig>) {
    const baseId = sanitizeTemplateId(partial?.id ?? `custom-${Date.now()}`, "custom");
    let id = baseId;
    let n = 2;
    while (templates.value.some((item) => item.id === id)) {
      id = `${baseId}-${n}`;
      n += 1;
    }
    templates.value.push({
      id,
      label: partial?.label?.trim() || "新模板",
      description: partial?.description?.trim() || "自定义结构",
      content: partial?.content?.trim() || `# {{title}}\n\n## 正文\n\n`,
    });
    persist();
    return id;
  }

  function removeTemplate(id: string) {
    if (templates.value.length <= 1) return false;
    const next = templates.value.filter((item) => item.id !== id);
    if (next.length === templates.value.length) return false;
    templates.value = next;
    persist();
    return true;
  }

  function buildContent(templateId: string, title: string): string {
    return buildTemplateContent(templates.value, templateId, title);
  }

  function primaryTemplateId(): string {
    return defaultTemplateId(templates.value);
  }

  return {
    templates,
    hydrate,
    resetDefaults,
    updateTemplate,
    addTemplate,
    removeTemplate,
    buildContent,
    primaryTemplateId,
    persist,
  };
});
