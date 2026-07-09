/** 有限并发执行异步任务 */
export async function runConcurrent<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 8,
): Promise<R[]> {
  if (!items.length) return [];
  const results: R[] = new Array(items.length);
  let next = 0;

  async function runWorker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }

  const pool = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: pool }, () => runWorker()));
  return results;
}
