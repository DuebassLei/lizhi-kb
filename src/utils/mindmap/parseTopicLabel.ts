/** 从主题文案中拆出 #标签（幕布常见写法） */
export function parseTopicLabel(text: string): { title: string; tags: string[] } {
  const tags: string[] = [];
  const title = text
    .replace(/(^|\s)#([\u4e00-\u9fa5\w-]+)/g, (_m, sp: string, tag: string) => {
      tags.push(tag);
      return sp;
    })
    .replace(/\s+/g, " ")
    .trim();
  return { title: title || text.trim(), tags };
}
