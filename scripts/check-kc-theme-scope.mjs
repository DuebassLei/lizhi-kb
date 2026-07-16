import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function sanitizeThemeCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<\/?script[\s\S]*?>/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/@import\b[\s\S]*?;/gi, "")
    .replace(/behavior\s*:/gi, "")
    .trim();
}

function scopeCss(raw, id) {
  const safe = sanitizeThemeCss(raw);
  const themeRoot = `.knowledge-card.theme-${id}`;
  return safe.replace(/(^|})\s*([^{}@]+)\s*{/g, (_, brace, sel) => {
    const parts = sel
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return `${brace} {`;
    const scoped = parts
      .map((t) => {
        if (t.startsWith(".knowledge-card")) {
          return `${themeRoot}${t.slice(".knowledge-card".length)}`;
        }
        return `${themeRoot} ${t}`;
      })
      .join(", ");
    return `${brace} ${scoped} {`;
  });
}

const comic = fs.readFileSync(
  path.join(root, "src/themes/knowledgeCards/presets/cartoon-comic.css"),
  "utf8",
);
const scoped = scopeCss(comic, "cartoon-comic");
const checks = [
  ["h2 rule", /\.theme-cartoon-comic .*h2\s*\{[^}]*32px/],
  ["hero h1", /\.theme-cartoon-comic .*is-hero h1\s*\{[^}]*56px/],
  ["list mark", /content:\s*"▸"/],
  ["bubble first-of-type BUG", /block-paragraph:first-of-type/],
];
for (const [name, re] of checks) {
  console.log(name, re.test(scoped) ? "YES" : "NO");
}
console.log("scoped bytes", scoped.length);
