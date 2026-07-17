<script setup lang="ts">
import { computed } from "vue";
import { editorPerfSnapshot, logEditorPerfHint } from "../../utils/editorPerf";

const rows = computed(() => {
  const s = editorPerfSnapshot.value;
  return [
    { key: "pinia", label: "内容同步", ms: s.contentUpdateMs, hint: "每键→Pinia" },
    { key: "gfm", label: "GFM 预览", ms: s.previewHtmlMs, hint: "停键后重绘" },
    { key: "wechat", label: "公众号预览", ms: s.previewWechatMs, hint: "停键后重绘" },
    { key: "save", label: "自动保存", ms: s.autosaveMs, hint: "停键落盘" },
  ];
});

const worst = computed(() => {
  let max = -1;
  let key = "";
  for (const r of rows.value) {
    if (r.ms != null && r.ms > max) {
      max = r.ms;
      key = r.key;
    }
  }
  return key;
});

function level(ms: number | null): "ok" | "warn" | "bad" | "na" {
  if (ms == null) return "na";
  if (ms >= 80) return "bad";
  if (ms >= 30) return "warn";
  return "ok";
}

function onCopy() {
  logEditorPerfHint();
  const text = rows.value
    .map((r) => `${r.label}: ${r.ms == null ? "—" : `${r.ms}ms`}`)
    .join("\n");
  void navigator.clipboard.writeText(text).catch(() => undefined);
}
</script>

<template>
  <aside
    class="editor-perf-hud"
    data-testid="editor-perf-hud"
    aria-label="编辑性能（仅开发）"
  >
    <div class="mb-1 flex items-center justify-between gap-2">
      <span class="font-medium">编辑性能</span>
      <button type="button" class="text-[10px] underline opacity-80 hover:opacity-100" @click="onCopy">
        复制
      </button>
    </div>
    <p class="mb-1.5 text-[10px] leading-snug opacity-70">
      打字约 10 秒后停一下，看「自动保存」；目标 &lt;80ms
    </p>
    <ul class="space-y-0.5">
      <li
        v-for="r in rows"
        :key="r.key"
        class="flex items-baseline justify-between gap-2"
        :class="{
          'font-semibold': worst === r.key && r.ms != null,
          'text-emerald-300': level(r.ms) === 'ok',
          'text-amber-300': level(r.ms) === 'warn',
          'text-rose-300': level(r.ms) === 'bad',
          'opacity-50': level(r.ms) === 'na',
        }"
      >
        <span>{{ r.label }}</span>
        <span class="tabular-nums">{{ r.ms == null ? "—" : `${r.ms}ms` }}</span>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.editor-perf-hud {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 80;
  width: 168px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.88);
  color: #e2e8f0;
  font-size: 11px;
  line-height: 1.35;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  pointer-events: auto;
}
</style>
