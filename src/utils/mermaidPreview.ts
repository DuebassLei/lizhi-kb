/** 预览区 Mermaid 图表渲染（动态加载，避免拖大主包） */

let mermaidMod: typeof import("mermaid") | null = null;
let initializedTheme: "dark" | "default" | null = null;

function resolveMermaidTheme(): "dark" | "default" {
  if (document.documentElement.style.colorScheme === "light") return "default";
  const theme = document.documentElement.dataset.theme;
  if (theme === "light" || theme === "warm" || theme === "eye" || theme === "reading") {
    return "default";
  }
  return "dark";
}

async function ensureMermaid(theme: "dark" | "default") {
  if (!mermaidMod) {
    mermaidMod = await import("mermaid");
  }
  if (initializedTheme !== theme) {
    mermaidMod.default.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme,
      fontFamily: "var(--font-sans, system-ui, sans-serif)",
    });
    initializedTheme = theme;
  }
  return mermaidMod.default;
}

/**
 * 对 root 内 `.preview-mermaid .mermaid` 节点执行渲染。
 * 失败时在节点旁展示可读错误，不抛到调用方。
 */
export async function renderMermaidIn(root: HTMLElement): Promise<void> {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(".preview-mermaid pre.mermaid"),
  ).filter((n) => !(n.dataset.mermaidRendered === "1"));
  if (nodes.length === 0) return;

  const theme = resolveMermaidTheme();
  const mermaid = await ensureMermaid(theme);

  await Promise.all(
    nodes.map(async (node, index) => {
      const code = (node.textContent ?? "").trim();
      if (!code) return;
      const wrap = node.closest(".preview-mermaid") as HTMLElement | null;
      const id = `lizhi-mmd-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        const { svg } = await mermaid.render(id, code);
        const host = document.createElement("div");
        host.className = "preview-mermaid-svg";
        host.innerHTML = svg;
        node.replaceWith(host);
        if (wrap) wrap.dataset.mermaidOk = "1";
      } catch (err) {
        node.dataset.mermaidRendered = "1";
        node.classList.add("preview-mermaid-code", "preview-mermaid-error");
        const msg = err instanceof Error ? err.message : String(err);
        if (wrap) {
          const label = document.createElement("div");
          label.className = "preview-mermaid-label preview-mermaid-label--error";
          label.textContent = `Mermaid 渲染失败：${msg}`;
          wrap.insertBefore(label, node);
        }
      }
    }),
  );
}
