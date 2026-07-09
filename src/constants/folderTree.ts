import type { InjectionKey, Ref } from "vue";

/** Sidebar 文档树滚动容器，供虚拟目录树监听 scroll */
export const SIDEBAR_SCROLL_KEY: InjectionKey<Ref<HTMLElement | null>> = Symbol("sidebarScrollEl");

/** 展开后可见行数超过此阈值时启用虚拟滚动 */
export const FOLDER_TREE_VIRTUAL_THRESHOLD = 64;

/** 每层级缩进（px）— 统一用于递归树与虚拟树，避免重复累加 */
export const TREE_INDENT_PX = 10;
export const TREE_ROW_PAD_PX = 2;
/** 文档行相对目录行额外缩进（对齐文件图标） */
export const TREE_DOC_EXTRA_PX = 4;

export function folderRowPadding(depth: number): number {
  return depth * TREE_INDENT_PX + TREE_ROW_PAD_PX;
}

export function docRowPadding(depth: number): number {
  return depth * TREE_INDENT_PX + TREE_ROW_PAD_PX + TREE_DOC_EXTRA_PX;
}

/** 子树左侧引导线偏移（固定，不随 depth 倍增） */
export const TREE_CHILD_GUIDE_PX = 4;
