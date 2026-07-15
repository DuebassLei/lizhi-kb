import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "./vaultService";
import {
  emptyDecor,
  normalizeDecor,
  type MubuDecor,
  type MubuDoc,
  type MubuNode,
  type MubuNodeInput,
  type MubuTreeNode,
} from "../types/mubu";

const STORAGE_KEY = "lizhi-kb-mubu";

interface StoredData {
  docs: MubuDoc[];
  nodesByDoc: Record<string, MubuNode[]>;
}

function loadStored(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { docs: [], nodesByDoc: {} };
    const parsed = JSON.parse(raw) as StoredData;
    return {
      docs: parsed.docs ?? [],
      nodesByDoc: Object.fromEntries(
        Object.entries(parsed.nodesByDoc ?? {}).map(([k, nodes]) => [
          k,
          nodes.map(normalizeNode),
        ]),
      ),
    };
  } catch {
    return { docs: [], nodesByDoc: {} };
  }
}

function saveStored(data: StoredData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizeNode(n: Partial<MubuNode> & { id: string }): MubuNode {
  return {
    id: n.id,
    docId: n.docId ?? "",
    parentId: n.parentId ?? null,
    sortOrder: n.sortOrder ?? 0,
    text: n.text ?? "",
    note: "",
    collapsed: Boolean(n.collapsed),
    isTodo: Boolean(n.isTodo),
    isDone: Boolean(n.isDone),
    headingLevel: Math.min(3, Math.max(0, n.headingLevel ?? 0)),
    decor: normalizeDecor(n.decor),
    createdAt: n.createdAt ?? Date.now(),
    updatedAt: n.updatedAt ?? Date.now(),
  };
}

async function withFallback<T>(
  cmd: string,
  args: Record<string, unknown>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (!isTauriRuntime()) return fallback();
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch {
    return fallback();
  }
}

function now() {
  return Date.now();
}

function newId() {
  return crypto.randomUUID();
}

export async function listMubuDocs(): Promise<MubuDoc[]> {
  return withFallback("list_mubu_docs", {}, () => {
    const data = loadStored();
    return [...data.docs].sort((a, b) => b.updatedAt - a.updatedAt);
  });
}

export async function createMubuDoc(title?: string): Promise<MubuDoc> {
  return withFallback("create_mubu_doc", { input: { title: title ?? null } }, () => {
    const data = loadStored();
    const t = title?.trim() || "未命名";
    const id = newId();
    const ts = now();
    const doc: MubuDoc = {
      id,
      title: t,
      styleJson: null,
      createdAt: ts,
      updatedAt: ts,
    };
    const root = normalizeNode({
      id: newId(),
      docId: id,
      parentId: null,
      sortOrder: 0,
      text: t,
      createdAt: ts,
      updatedAt: ts,
    });
    data.docs.unshift(doc);
    data.nodesByDoc[id] = [root];
    saveStored(data);
    return doc;
  });
}

export async function updateMubuDoc(
  id: string,
  patch: { title?: string; styleJson?: string | null },
): Promise<MubuDoc> {
  return withFallback("update_mubu_doc", { id, patch }, () => {
    const data = loadStored();
    const doc = data.docs.find((d) => d.id === id);
    if (!doc) throw new Error("幕布文档不存在");
    if (patch.title !== undefined) {
      const t = patch.title.trim() || "未命名";
      doc.title = t;
      const nodes = data.nodesByDoc[id] ?? [];
      const root = nodes.find((n) => n.parentId === null);
      if (root) root.text = t;
    }
    if (patch.styleJson !== undefined) doc.styleJson = patch.styleJson;
    doc.updatedAt = now();
    saveStored(data);
    return { ...doc };
  });
}

export async function deleteMubuDoc(id: string): Promise<void> {
  return withFallback("delete_mubu_doc", { id }, () => {
    const data = loadStored();
    data.docs = data.docs.filter((d) => d.id !== id);
    delete data.nodesByDoc[id];
    saveStored(data);
  });
}

export async function getMubuTree(docId: string): Promise<MubuNode[]> {
  return withFallback("get_mubu_tree", { docId }, () => {
    const data = loadStored();
    return (data.nodesByDoc[docId] ?? []).map(normalizeNode);
  }).then((nodes) => nodes.map(normalizeNode));
}

export async function saveMubuTree(
  docId: string,
  nodes: MubuNodeInput[],
  title?: string,
): Promise<MubuDoc> {
  return withFallback(
    "save_mubu_tree",
    { docId, input: { nodes, title: title ?? null } },
    () => {
      const data = loadStored();
      const doc = data.docs.find((d) => d.id === docId);
      if (!doc) throw new Error("幕布文档不存在");
      const ts = now();
      const root = nodes.find((n) => n.parentId === null);
      doc.title = title?.trim() || root?.text.trim() || doc.title;
      doc.updatedAt = ts;
      data.nodesByDoc[docId] = nodes.map((n) =>
        normalizeNode({
          id: n.id,
          docId,
          parentId: n.parentId,
          sortOrder: n.sortOrder,
          text: n.text,
          collapsed: n.collapsed,
          isTodo: n.isTodo,
          isDone: n.isDone,
          headingLevel: n.headingLevel,
          decor: n.decor ?? emptyDecor(),
          createdAt: n.createdAt ?? ts,
          updatedAt: n.updatedAt ?? ts,
        }),
      );
      saveStored(data);
      return { ...doc };
    },
  );
}

export function buildMubuTree(flat: MubuNode[]): MubuTreeNode | null {
  if (!flat.length) return null;
  const map = new Map<string, MubuTreeNode>();
  for (const n of flat) {
    map.set(n.id, { ...normalizeNode(n), children: [] });
  }
  let root: MubuTreeNode | null = null;
  for (const n of flat) {
    const node = map.get(n.id)!;
    if (!n.parentId) {
      root = node;
      continue;
    }
    const parent = map.get(n.parentId);
    if (parent) parent.children.push(node);
  }
  if (root) {
    const sortRec = (n: MubuTreeNode) => {
      n.children.sort((a, b) => a.sortOrder - b.sortOrder);
      n.children.forEach(sortRec);
    };
    sortRec(root);
  }
  return root;
}

export function flattenMubuTree(root: MubuTreeNode): MubuNodeInput[] {
  const out: MubuNodeInput[] = [];
  const walk = (n: MubuTreeNode) => {
    out.push({
      id: n.id,
      parentId: n.parentId,
      sortOrder: n.sortOrder,
      text: n.text,
      collapsed: n.collapsed,
      isTodo: n.isTodo,
      isDone: n.isDone,
      headingLevel: n.headingLevel,
      decor: n.decor ?? emptyDecor(),
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    });
    n.children.forEach((c, i) => {
      c.sortOrder = i;
      c.parentId = n.id;
      walk(c);
    });
  };
  walk(root);
  return out;
}

export function countMubuStats(root: MubuTreeNode | null): {
  topics: number;
  chars: number;
} {
  if (!root) return { topics: 0, chars: 0 };
  let topics = 0;
  let chars = 0;
  const walk = (n: MubuTreeNode) => {
    topics += 1;
    chars += [...n.text].length;
    n.children.forEach(walk);
  };
  walk(root);
  return { topics, chars };
}

export type { MubuDecor };
