function wrapListItems(doc: Document): void {
  const lis = doc.querySelectorAll("li");
  lis.forEach((li) => {
    if (li.children.length === 1 && li.children[0]?.tagName === "SECTION") return;
    const section = doc.createElement("section");
    while (li.firstChild) {
      section.appendChild(li.firstChild);
    }
    li.appendChild(section);
  });
}

function wrapHeadingContent(doc: Document): void {
  const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
  headings.forEach((h) => {
    if (h.querySelector(".content")) return;
    const children = Array.from(h.childNodes);
    if (children.length === 0) return;

    const prefix = doc.createElement("span");
    prefix.className = "prefix";

    const content = doc.createElement("span");
    content.className = "content";
    children.forEach((child) => content.appendChild(child));

    const suffix = doc.createElement("span");
    suffix.className = "suffix";

    h.appendChild(prefix);
    h.appendChild(content);
    h.appendChild(suffix);
  });
}

/** 对 marked 渲染后的 HTML 做微信适配的 DOM 结构变换 */
export function postProcessForWechat(html: string): string {
  if (typeof DOMParser === "undefined") return `<section id="nice">${html}</section>`;

  try {
    const doc = new DOMParser().parseFromString(
      `<section id="nice">${html}</section>`,
      "text/html",
    );
    wrapListItems(doc);
    wrapHeadingContent(doc);
    const nice = doc.querySelector("#nice");
    return nice ? nice.outerHTML : `<section id="nice">${html}</section>`;
  } catch {
    return `<section id="nice">${html}</section>`;
  }
}
