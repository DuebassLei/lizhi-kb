/**
 * Replace broken :first-of-type paragraph selectors with .is-lead
 * (all card-blocks are <div>, so :first-of-type never matches paragraphs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/themes/knowledgeCards/presets",
);

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".css"));
let changed = 0;
for (const file of files) {
  const fp = path.join(dir, file);
  let css = fs.readFileSync(fp, "utf8");
  const before = css;
  css = css.replaceAll(
    ".knowledge-card-content > .card-block.block-paragraph:first-of-type",
    ".card-block.block-paragraph.is-lead",
  );
  css = css.replaceAll(
    ".knowledge-card .knowledge-card-content > .card-block.block-paragraph:first-of-type",
    ".card-block.block-paragraph.is-lead",
  );
  // deck / lead adjacent variants — keep hero+p AND add is-lead
  if (
    file === "cartoon-comic.css" &&
    !css.includes(".card-block.block-paragraph.is-lead")
  ) {
    // no-op if already replaced
  }
  if (css !== before) {
    fs.writeFileSync(fp, css);
    changed += 1;
    console.log("updated", file);
  }
}
console.log("files changed:", changed);
