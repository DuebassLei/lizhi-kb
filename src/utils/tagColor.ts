/** Stable hash → one of 8 theme-safe tag pill variants. */
export const TAG_COLOR_VARIANT_COUNT = 8;

export function hashTagString(tag: string): number {
  const normalized = tag.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getTagColorVariant(tag: string): number {
  return hashTagString(tag) % TAG_COLOR_VARIANT_COUNT;
}

export function getTagPillClass(tag: string): string {
  return `doc-tag-pill doc-tag-pill--${getTagColorVariant(tag)}`;
}
