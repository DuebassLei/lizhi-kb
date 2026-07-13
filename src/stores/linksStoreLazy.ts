/** 延迟加载 links store，避免 documents ↔ links 循环依赖 */
export async function getLinksStore() {
  const { useLinksStore } = await import("./links");
  return useLinksStore();
}
