#!/usr/bin/env node
/**
 * 双轨 Agent 配置校验脚本
 * 用法（在项目根目录下）：
 *   node scripts/sync-agent-config.mjs --check
 *   node scripts/sync-agent-config.mjs --report
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOCS = join(ROOT, 'docs', 'agent-workflow');

const PAIRS = [
  ['.claude/rules/vue-frontend.md', '.cursor/rules/vue-frontend.mdc'],
  ['.claude/rules/tauri-rust.md', '.cursor/rules/tauri-rust.mdc'],
];

const REQUIRED = [
  'AGENTS.md',
  'CLAUDE.md',
  'docs/agent-workflow/README.md',
  'docs/agent-workflow/multi-agent-workflow.md',
  'docs/agent-workflow/sync-strategy.md',
  'docs/agent-workflow/handoff-template.md',
  'docs/agent-workflow/verification.md',
  '.cursor/rules/lizhi-kb-core.mdc',
  '.claude/agents/planner.md',
  '.claude/agents/implementer.md',
  '.claude/agents/reviewer.md',
  '.claude/agents/debugger.md',
  '.claude/commands/lizhi-feature.md',
  '.claude/skills/lizhi-workflow/SKILL.md',
  'docs/superpowers/specs/2026-07-06-lizhi-kb-complete-design.md',
  'docs/design/初版设计.md',
];

const SSOT_LINK = 'docs/agent-workflow';

function checkRequired() {
  return REQUIRED.filter((p) => !existsSync(join(ROOT, p)));
}

function checkPairs() {
  const issues = [];
  for (const [claudeRel, cursorRel] of PAIRS) {
    if (!existsSync(join(ROOT, claudeRel))) issues.push(`缺少 Claude: ${claudeRel}`);
    if (!existsSync(join(ROOT, cursorRel))) issues.push(`缺少 Cursor: ${cursorRel}`);
  }
  return issues;
}

function checkSsotLinks() {
  const issues = [];
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    if (!content.includes(SSOT_LINK) && !content.includes('agent-workflow')) {
      issues.push(`${file} 未引用 docs/agent-workflow/`);
    }
  }
  return issues;
}

function checkTemplates() {
  const templates = ['feature', 'bugfix', 'ui', 'export', 'tauri-backend'];
  return templates
    .filter((t) => !existsSync(join(DOCS, 'templates', `${t}.md`)))
    .map((t) => `缺少模板 templates/${t}.md`);
}

const mode = process.argv.includes('--report') ? 'report' : 'check';

const missing = checkRequired();
const pairIssues = checkPairs();
const linkIssues = checkSsotLinks();
const templateIssues = checkTemplates();
const all = [
  ...missing.map((m) => `缺少: ${m}`),
  ...pairIssues,
  ...linkIssues,
  ...templateIssues,
];

if (mode === 'report') {
  console.log('=== 狸知 Agent 双轨配置报告 ===\n');
  console.log('必需文件:', REQUIRED.length - missing.length, '/', REQUIRED.length);
  console.log('规则对:', PAIRS.length - pairIssues.length / 2, '/', PAIRS.length);
  console.log('模板:', 5 - templateIssues.length, '/ 5');
  if (all.length) {
    console.log('\n问题:');
    all.forEach((i) => console.log('  -', i));
  } else {
    console.log('\n✓ 配置完整');
  }
} else {
  if (all.length) {
    console.error('Agent 配置校验失败:\n' + all.map((i) => `  - ${i}`).join('\n'));
    process.exit(1);
  }
  console.log('✓ Agent 双轨配置校验通过');
}
