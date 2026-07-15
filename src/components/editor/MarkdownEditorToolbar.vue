<template>
  <div class="editor-toolbar" data-testid="editor-toolbar" role="toolbar" aria-label="Markdown 格式">
    <div class="editor-toolbar__group">
      <BtnIcon label="粗体" @click="wrap('**', '**')">
        <Bold class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
      <BtnIcon label="斜体" @click="wrap('*', '*')">
        <Italic class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
      <BtnIcon label="删除线" @click="wrap('~~', '~~')">
        <Strikethrough class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
    </div>

    <span class="editor-toolbar__sep" aria-hidden="true" />

    <div class="editor-toolbar__group">
      <BtnIcon label="标题 1" @click="heading(1)">
        <Heading1 class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
      <BtnIcon label="标题 2" @click="heading(2)">
        <Heading2 class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
      <BtnIcon label="标题 3" @click="heading(3)">
        <Heading3 class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
    </div>

    <span class="editor-toolbar__sep" aria-hidden="true" />

    <div class="editor-toolbar__group">
      <BtnIcon label="无序列表" @click="prefixLines(view, '- ')">
        <List class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
      <BtnIcon label="有序列表" @click="prefixLines(view, '1. ')">
        <ListOrdered class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
      <BtnIcon label="引用" @click="prefixLines(view, '> ')">
        <Quote class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
      <BtnIcon label="代码块" @click="insertAtCursor(view, '\n```\n\n```\n')">
        <Code2 class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
      <BtnIcon label="表格" @click="insertTable">
        <Table class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
      <BtnIcon label="分隔线" @click="insertAtCursor(view, '\n---\n')">
        <Minus class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
    </div>

    <span class="editor-toolbar__sep" aria-hidden="true" />

    <div class="editor-toolbar__group">
      <BtnIcon label="双链" title="插入双链（Ctrl+Shift+L）" @click="openWikiLinkPicker">
        <span class="font-mono text-[11px] font-semibold leading-none" aria-hidden="true">[[</span>
      </BtnIcon>
      <BtnIcon label="链接" @click="insertLink">
        <Link class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
      <BtnIcon label="插入图片" @click="insertImage">
        <ImageIcon class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
      <EmojiPicker @select="insertEmoji" />
    </div>

    <span class="editor-toolbar__sep" aria-hidden="true" />

    <div class="editor-toolbar__group">
      <button
        type="button"
        class="editor-toolbar__wa focus-ring inline-flex items-center gap-1 rounded-md px-2 h-7 text-xs text-[var(--color-paw)] hover:bg-surface-2 transition-colors"
        title="打开写作助手"
        aria-label="打开写作助手"
        data-testid="wa-toolbar-open"
        @click="openWritingAssistant"
      >
        <Sparkles class="h-3.5 w-3.5" aria-hidden="true" />
        <span>写作助手</span>
      </button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onImageFileSelected"
    />

    <WikiLinkPickerDialog
      :open="wikiLinkPickerOpen"
      :view="view"
      @cancel="wikiLinkPickerOpen = false"
    />

    <InputDialog
      :open="linkDialogOpen"
      title="插入链接"
      label="链接 URL"
      placeholder="https://example.com"
      hint="选中文本后插入将包裹为 Markdown 链接；未选中则创建空链接文本。"
      test-id="editor-link-dialog"
      @confirm="onLinkConfirm"
      @cancel="linkDialogOpen = false"
    />

    <InputDialog
      :open="imageUrlDialogOpen"
      title="插入图片"
      label="图片 URL"
      placeholder="https://example.com/image.png"
      hint="Shift + 点击「插入图片」可粘贴远程图片地址；普通点击仍从本地上传。"
      test-id="editor-image-url-dialog"
      @confirm="onImageUrlConfirm"
      @cancel="imageUrlDialogOpen = false"
    />

    <button
      v-if="pendingImageFile"
      type="button"
      class="editor-toolbar__retry focus-ring rounded px-2 py-0.5 text-[10px] text-danger"
      data-testid="editor-image-retry"
      @click="retryImageUpload"
    >
      重试上传
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { EditorView } from "@codemirror/view";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Minus,
  Table,
  Link,
  Image as ImageIcon,
  Sparkles,
} from "@lucide/vue";
import { insertImageFromFile } from "../../utils/editorImageInsert";
import { insertAtCursor, insertTableAtCursor, prefixLines, wrapSelection } from "../../utils/markdownInsert";
import { useUiStore } from "../../stores/ui";
import { useWritingAssistantStore } from "../../stores/writingAssistant";
import InputDialog from "../common/InputDialog.vue";
import BtnIcon from "../ui/BtnIcon.vue";
import EmojiPicker from "./EmojiPicker.vue";
import WikiLinkPickerDialog from "./WikiLinkPickerDialog.vue";

const props = defineProps<{
  view: EditorView;
}>();

const ui = useUiStore();
const writingAssistant = useWritingAssistantStore();
const fileInputRef = ref<HTMLInputElement | null>(null);
const savingImage = ref(false);
const pendingImageFile = ref<File | null>(null);
const linkDialogOpen = ref(false);
const imageUrlDialogOpen = ref(false);
const wikiLinkPickerOpen = ref(false);

function wrap(before: string, after: string) {
  wrapSelection(props.view, before, after);
}

function heading(level: number) {
  prefixLines(props.view, "#".repeat(level) + " ");
}

function insertTable() {
  insertTableAtCursor(props.view);
}

function insertImage(event: MouseEvent) {
  if (event.shiftKey) {
    imageUrlDialogOpen.value = true;
    return;
  }
  fileInputRef.value?.click();
}

function onLinkConfirm(url: string) {
  linkDialogOpen.value = false;
  wrapSelection(props.view, "[", `](${url})`);
}

function onImageUrlConfirm(url: string) {
  imageUrlDialogOpen.value = false;
  insertAtCursor(props.view, `![图片](${url})`);
}

async function uploadImageFile(file: File) {
  savingImage.value = true;
  try {
    await insertImageFromFile(props.view, file);
    pendingImageFile.value = null;
  } catch (e) {
    pendingImageFile.value = file;
    ui.showToast("error", e instanceof Error ? e.message : "图片上传失败，请重试");
  } finally {
    savingImage.value = false;
  }
}

async function onImageFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || savingImage.value) return;
  if (!file.type.startsWith("image/")) return;
  await uploadImageFile(file);
}

async function retryImageUpload() {
  if (!pendingImageFile.value || savingImage.value) return;
  await uploadImageFile(pendingImageFile.value);
}

function insertLink() {
  linkDialogOpen.value = true;
}

function openWikiLinkPicker() {
  wikiLinkPickerOpen.value = true;
}

function insertEmoji(emoji: string) {
  insertAtCursor(props.view, emoji);
}

function openWritingAssistant() {
  void writingAssistant.loadAiState();
  writingAssistant.openDialog();
}
</script>
