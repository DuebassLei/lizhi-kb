#!/usr/bin/env node
/**
 * 仅前端门禁：vue-tsc → vite（串行，避免双重量级工具争抢）
 */

import { runSerial } from "./run-steps.mjs";

await runSerial([
  { label: "vue-tsc", cmd: "pnpm", args: ["exec", "vue-tsc", "--noEmit"] },
  { label: "vite build", cmd: "pnpm", args: ["exec", "vite", "build"] },
]);

console.log("\n✓ pnpm verify:fe 完成");
