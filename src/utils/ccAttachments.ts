export type CcAttachmentKind = "image" | "file";

export interface CcChatAttachment {
  path: string;
  name: string;
  kind: CcAttachmentKind;
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
]);

export function attachmentNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

export function isImageAttachmentPath(path: string): boolean {
  const name = attachmentNameFromPath(path);
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return IMAGE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

export function attachmentFromPath(path: string): CcChatAttachment {
  const trimmed = path.trim();
  return {
    path: trimmed,
    name: attachmentNameFromPath(trimmed),
    kind: isImageAttachmentPath(trimmed) ? "image" : "file",
  };
}

export function mergeAttachments(
  current: CcChatAttachment[],
  paths: string[],
): CcChatAttachment[] {
  const seen = new Set(current.map((item) => item.path));
  const next = [...current];
  for (const raw of paths) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(attachmentFromPath(trimmed));
  }
  return next;
}
