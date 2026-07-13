<script setup lang="ts">
import { BookOpen, FileCode, FolderTree, Lightbulb, Link2, X } from "@lucide/vue";

import Btn from "../../ui/Btn.vue";

defineProps<{ open: boolean }>();

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cc-skill-dialog__overlay" @click.self="emit('close')">
      <div class="cc-skill-dialog cc-skill-dialog--help" role="dialog" aria-modal="true">
        <header class="cc-skill-dialog__header">
          <h3>什么是 Skills？</h3>
          <button type="button" class="cc-skill-dialog__close" title="关闭" @click="emit('close')">
            <X class="h-4 w-4" />
          </button>
        </header>
        <div class="cc-skill-dialog__body cc-skill-dialog__help">
          <section class="cc-skill-help__section">
            <h4><BookOpen class="h-4 w-4 text-link" />概述</h4>
            <p>
              Skills 是 Claude Agent 的可复用能力扩展。每个 Skill 是一个包含
              <code>SKILL.md</code> 的目录，Agent 会在相关任务中自动加载并遵循其中的指令。
            </p>
          </section>

          <section class="cc-skill-help__section">
            <h4><FolderTree class="h-4 w-4 text-link" />目录结构</h4>
            <p>Skill 通常以目录形式存放，至少包含一个说明文件：</p>
            <pre class="cc-skill-help__code">my-skill/
  SKILL.md</pre>
          </section>

          <section class="cc-skill-help__section">
            <h4><FileCode class="h-4 w-4 text-link" />SKILL.md 格式</h4>
            <p>
              推荐使用 YAML frontmatter，其中 <code>description</code> 字段会显示在列表中；若无该字段，则取正文首段。
            </p>
            <pre class="cc-skill-help__code">---
name: my-skill
description: 技能说明及适用场景
---

# 技能标题

正文指令…</pre>
          </section>

          <section class="cc-skill-help__section">
            <h4>存放位置</h4>
            <ul>
              <li><strong>全局</strong>：<code>~/.claude/skills/</code> — 对所有项目生效</li>
              <li><strong>项目</strong>：<code>{项目}/.claude/skills/</code> — 仅当前项目生效</li>
              <li>禁用的 Skill 会移至 <code>~/.lizhi-kb/cc-skills-disabled/</code> 管理，不会丢失文件</li>
            </ul>
          </section>

          <section class="cc-skill-help__section">
            <h4><Lightbulb class="h-4 w-4 text-link" />使用建议</h4>
            <ul>
              <li>用简短、可识别的目录名作为 Skill 名称</li>
              <li>在 SKILL.md 开头写清楚适用场景与操作步骤</li>
              <li>项目级 Skill 适合与代码库绑定的专用流程</li>
              <li>可通过「导入」从本地目录复制 Skill 到全局或项目目录</li>
              <li>禁用而非删除，便于临时关闭某个 Skill</li>
            </ul>
          </section>

          <section class="cc-skill-help__section">
            <h4><Link2 class="h-4 w-4 text-link" />了解更多</h4>
            <ul>
              <li>
                <a
                  href="https://support.claude.com/en/articles/12512176-what-are-skills"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Claude 官方：什么是 Skills
                </a>
              </li>
              <li>
                <a
                  href="https://support.claude.com/en/articles/12512198-creating-custom-skills"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  创建自定义 Skills
                </a>
              </li>
              <li>
                <a href="https://github.com/anthropics/skills" target="_blank" rel="noopener noreferrer">
                  Anthropic Skills 示例仓库
                </a>
              </li>
            </ul>
          </section>
        </div>
        <footer class="cc-skill-dialog__footer">
          <Btn variant="secondary" size="sm" @click="emit('close')">知道了</Btn>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cc-skill-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, black 45%, transparent);
  padding: 1rem;
}

.cc-skill-dialog {
  width: min(100%, 34rem);
  max-height: min(85vh, 40rem);
  display: flex;
  flex-direction: column;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 12px 40px color-mix(in srgb, black 18%, transparent);
}

.cc-skill-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.cc-skill-dialog__header h3 {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-skill-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  padding: 0.25rem;
  color: var(--color-muted);
}

.cc-skill-dialog__close:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.cc-skill-dialog__body {
  padding: 1rem;
  overflow-y: auto;
}

.cc-skill-dialog__help {
  line-height: 1.55;
}

.cc-skill-help__section {
  margin-bottom: 1.125rem;
}

.cc-skill-help__section:last-child {
  margin-bottom: 0;
}

.cc-skill-help__section h4 {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
}

.cc-skill-help__section p,
.cc-skill-help__section li {
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-skill-help__section ul {
  margin: 0;
  padding-left: 1.125rem;
}

.cc-skill-help__section li {
  margin-bottom: 0.25rem;
}

.cc-skill-help__section a {
  color: var(--color-link);
}

.cc-skill-help__section a:hover {
  text-decoration: underline;
}

.cc-skill-help__code {
  margin-top: 0.375rem;
  border-radius: 0.375rem;
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
  padding: 0.625rem 0.75rem;
  font-size: 0.6875rem;
  font-family: ui-monospace, monospace;
  white-space: pre-wrap;
}

.cc-skill-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}
</style>
