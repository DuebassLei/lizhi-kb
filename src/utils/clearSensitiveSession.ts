import { useCredentialsStore } from "../stores/credentials";
import { useDocumentsStore } from "../stores/documents";
import { useEditorStore } from "../stores/editor";
import { useLinksStore } from "../stores/links";

/** 锁定 vault 时清空前端敏感内存（正文、链接索引片段、凭据等） */
export function clearSensitiveSessionData() {
  useDocumentsStore().clearActive();
  useLinksStore().clear();
  useCredentialsStore().clear();
  useEditorStore().clear();
}
