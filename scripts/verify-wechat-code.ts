import {
  assertWechatCodeHighlight,
  highlightCodeToWechatHtml,
} from "../src/services/wechatExport/highlightCodeForWechat.ts";

const sql = "select * from sql";
const html = highlightCodeToWechatHtml(sql, "sql", "lizhiPurple");
const errors = assertWechatCodeHighlight(html, sql);

console.log("highlight output:", html);
console.log("assertions:", errors.length ? errors : "OK");

if (errors.length) process.exit(1);

// keyword select/from/sql should be purple-ish, * operator cyan
const colors = [...html.matchAll(/<font color="([^"]+)">/g)].map((m) => m[1]);
const unique = [...new Set(colors)];
console.log("unique colors:", unique);
if (unique.length < 2) {
  console.error("expected at least 2 distinct token colors, got", unique);
  process.exit(1);
}

console.log("verify-wechat-code: passed");
