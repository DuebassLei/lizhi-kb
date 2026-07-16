import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  buildMubuTree,
  createMubuDoc,
  deleteMubuDoc,
  flattenMubuTree,
  getMubuTree,
  listMubuDocs,
  saveMubuTree,
  updateMubuDoc,
} from "../services/mubuService";
import type { MubuDoc, MubuPaneMode, MubuTreeNode } from "../types/mubu";
import { useUiStore } from "./ui";

export const useMubuStore = defineStore("mubu", () => {
  const docs = ref<MubuDoc[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref<string | null>(null);
  const activeId = ref<string | null>(null);
  const tree = ref<MubuTreeNode | null>(null);
  const dirty = ref(false);
  const saving = ref(false);
  const paneMode = ref<MubuPaneMode>("notes");
  const selectedNodeId = ref<string | null>(null);

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const activeDoc = computed(
    () => docs.value.find((d) => d.id === activeId.value) ?? null,
  );

  async function fetchDocs() {
    loading.value = true;
    error.value = null;
    try {
      docs.value = await listMubuDocs();
      loaded.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "加载失败";
    } finally {
      loading.value = false;
    }
  }

  async function ensureLoaded() {
    if (!loaded.value) await fetchDocs();
  }

  async function openDoc(id: string) {
    if (dirty.value && activeId.value) {
      await flushSave();
    }
    activeId.value = id;
    selectedNodeId.value = null;
    dirty.value = false;
    const flat = await getMubuTree(id);
    tree.value = buildMubuTree(flat);
    if (tree.value) selectedNodeId.value = tree.value.id;
  }

  async function addDoc(title?: string) {
    const ui = useUiStore();
    try {
      const doc = await createMubuDoc(title);
      docs.value = [doc, ...docs.value.filter((d) => d.id !== doc.id)];
      await openDoc(doc.id);
      ui.showToast("success", "已新建织念");
      return doc;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "新建失败";
      ui.showToast("error", msg);
      throw e;
    }
  }

  async function renameDoc(id: string, title: string) {
    const doc = await updateMubuDoc(id, { title });
    docs.value = docs.value.map((d) => (d.id === id ? doc : d));
    if (activeId.value === id && tree.value && !tree.value.parentId) {
      tree.value.text = doc.title;
      markDirty();
    }
  }

  async function removeDoc(id: string) {
    const ui = useUiStore();
    await deleteMubuDoc(id);
    docs.value = docs.value.filter((d) => d.id !== id);
    if (activeId.value === id) {
      activeId.value = null;
      tree.value = null;
      dirty.value = false;
    }
    ui.showToast("success", "已删除");
  }

  function markDirty() {
    dirty.value = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void flushSave();
    }, 500);
  }

  async function flushSave() {
    if (!activeId.value || !tree.value || !dirty.value) return;
    if (saving.value) return;
    saving.value = true;
    const ui = useUiStore();
    try {
      const flat = flattenMubuTree(tree.value);
      const doc = await saveMubuTree(activeId.value, flat, tree.value.text);
      docs.value = docs.value.map((d) => (d.id === doc.id ? doc : d));
      // refresh timestamps on nodes
      const reloaded = await getMubuTree(doc.id);
      const rebuilt = buildMubuTree(reloaded);
      if (rebuilt) tree.value = rebuilt;
      dirty.value = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      ui.showToast("error", msg);
    } finally {
      saving.value = false;
    }
  }

  function setTree(next: MubuTreeNode) {
    tree.value = next;
    markDirty();
  }

  function closeDoc() {
    void flushSave();
    activeId.value = null;
    tree.value = null;
    dirty.value = false;
  }

  return {
    docs,
    loading,
    loaded,
    error,
    activeId,
    activeDoc,
    tree,
    dirty,
    saving,
    paneMode,
    selectedNodeId,
    fetchDocs,
    ensureLoaded,
    openDoc,
    addDoc,
    renameDoc,
    removeDoc,
    markDirty,
    flushSave,
    setTree,
    closeDoc,
  };
});
