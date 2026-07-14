import { getCurrentInstance, onUnmounted, ref, type Ref } from "vue";
import { resolveAssetUrl, toAssetRef } from "../services/assetService";

const DEFAULT_CONCURRENCY = 4;

/**
 * Lazy-load asset:// image URLs with IntersectionObserver + concurrency limit.
 * Call observe(el, id) for each thumb host; URLs appear in `thumbs`.
 */
export function useAssetThumbLoader(options?: { concurrency?: number }) {
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const thumbs = ref<Record<string, string>>({});
  const urlCache = new Map<string, string>();
  const inFlight = new Set<string>();
  const queue: string[] = [];
  let active = 0;

  let observer: IntersectionObserver | null = null;
  let scrollRoot: Element | null = null;
  const observedEls = new Set<Element>();
  const elToId = new WeakMap<Element, string>();

  function ensureObserver(): IntersectionObserver | null {
    if (typeof IntersectionObserver === "undefined") return null;
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const id = elToId.get(entry.target);
            if (!id) continue;
            enqueue(id);
            observer?.unobserve(entry.target);
            observedEls.delete(entry.target);
          }
        },
        { root: scrollRoot, rootMargin: "80px 0px", threshold: 0.01 },
      );
    }
    return observer;
  }

  /** Use the panel scroll container so off-viewport rows inside the sidebar don't resolve. */
  function setRoot(el: Element | null) {
    if (el === scrollRoot) return;
    scrollRoot = el;
    const prev = [...observedEls];
    observer?.disconnect();
    observer = null;
    observedEls.clear();
    const io = ensureObserver();
    for (const node of prev) {
      const id = elToId.get(node);
      if (!id || urlCache.has(id)) continue;
      if (io) {
        observedEls.add(node);
        io.observe(node);
      } else {
        enqueue(id);
      }
    }
  }

  function enqueue(id: string) {
    if (!id || urlCache.has(id) || inFlight.has(id) || queue.includes(id)) {
      if (urlCache.has(id)) {
        thumbs.value = { ...thumbs.value, [id]: urlCache.get(id)! };
      }
      return;
    }
    queue.push(id);
    pump();
  }

  function pump() {
    while (active < concurrency && queue.length > 0) {
      const id = queue.shift()!;
      if (urlCache.has(id)) {
        thumbs.value = { ...thumbs.value, [id]: urlCache.get(id)! };
        continue;
      }
      active += 1;
      inFlight.add(id);
      void resolveAssetUrl(toAssetRef(id))
        .then((url) => {
          urlCache.set(id, url);
          thumbs.value = { ...thumbs.value, [id]: url };
        })
        .catch(() => {
          /* leave placeholder */
        })
        .finally(() => {
          inFlight.delete(id);
          active -= 1;
          pump();
        });
    }
  }

  function observe(el: Element | null, id: string) {
    if (!el || !id) return;
    if (urlCache.has(id)) {
      thumbs.value = { ...thumbs.value, [id]: urlCache.get(id)! };
      return;
    }
    const io = ensureObserver();
    elToId.set(el, id);
    if (io) {
      observedEls.add(el);
      io.observe(el);
    } else {
      // JSDOM / unsupported: fall back to immediate enqueue
      enqueue(id);
    }
  }

  function invalidate(ids?: string[]) {
    if (!ids) {
      urlCache.clear();
      thumbs.value = {};
      queue.length = 0;
      return;
    }
    for (const id of ids) {
      urlCache.delete(id);
      const next = { ...thumbs.value };
      delete next[id];
      thumbs.value = next;
    }
  }

  function retainOnly(validIds: Set<string>) {
    for (const id of [...urlCache.keys()]) {
      if (!validIds.has(id)) urlCache.delete(id);
    }
    const next: Record<string, string> = {};
    for (const [id, url] of Object.entries(thumbs.value)) {
      if (validIds.has(id)) next[id] = url;
    }
    thumbs.value = next;
  }

  function dispose() {
    observer?.disconnect();
    observer = null;
    observedEls.clear();
    queue.length = 0;
  }

  if (getCurrentInstance()) {
    onUnmounted(dispose);
  }

  return {
    thumbs: thumbs as Ref<Record<string, string>>,
    setRoot,
    observe,
    enqueue,
    invalidate,
    retainOnly,
    dispose,
  };
}
