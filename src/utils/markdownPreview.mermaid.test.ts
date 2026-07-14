import { describe, expect, it } from "vitest";
import { markdownToPreviewHtml } from "./markdownPreview";

describe("markdownToPreviewHtml mermaid", () => {
  it("emits preview-mermaid host with pre.mermaid source", () => {
    const md = ["```mermaid", "sequenceDiagram", "  A->>B: hi", "```"].join("\n");
    const html = markdownToPreviewHtml(md);
    expect(html).toContain('class="preview-mermaid"');
    expect(html).toContain('class="mermaid"');
    expect(html).toContain("sequenceDiagram");
    expect(html).toContain("A-&gt;&gt;B: hi");
    expect(html).not.toContain("Mermaid 图表");
  });
});
