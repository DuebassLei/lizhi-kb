<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Eye, EyeOff, Star, X } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import Input from "../ui/Input.vue";
import { CREDENTIAL_CATEGORIES } from "../../constants/credentialCategories";
import { CREDENTIAL_ENVIRONMENTS } from "../../constants/credentialEnvironments";
import type { CreateCredentialInput } from "../../types/credential";

const props = defineProps<{
  open: boolean;
  editingId: string | null;
  draft: CreateCredentialInput | null;
}>();

const emit = defineEmits<{
  close: [];
  save: [input: CreateCredentialInput];
  delete: [];
}>();

const title = ref("");
const category = ref<CreateCredentialInput["category"]>("other");
const environment = ref<NonNullable<CreateCredentialInput["environment"]>>("local");
const username = ref("");
const password = ref("");
const url = ref("");
const notes = ref("");
const isFavorite = ref(false);
const showPassword = ref(false);

let revealTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.draft,
  (draft) => {
    if (!draft) return;
    title.value = draft.title;
    category.value = draft.category ?? "other";
    environment.value = draft.environment ?? "local";
    username.value = draft.username ?? "";
    password.value = draft.password ?? "";
    url.value = draft.url ?? "";
    notes.value = draft.notes ?? "";
    isFavorite.value = draft.isFavorite ?? false;
    showPassword.value = false;
  },
  { immediate: true },
);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      showPassword.value = false;
      password.value = "";
      if (revealTimer) clearTimeout(revealTimer);
    }
  },
);

const canSave = computed(() => title.value.trim().length > 0);

const heading = computed(() => (props.editingId ? "编辑凭据" : "新建凭据"));

function togglePasswordVisibility() {
  showPassword.value = !showPassword.value;
  if (revealTimer) clearTimeout(revealTimer);
  if (showPassword.value) {
    revealTimer = setTimeout(() => {
      showPassword.value = false;
    }, 30_000);
  }
}

function handleSave() {
  if (!canSave.value) return;
  emit("save", {
    title: title.value.trim(),
    category: category.value,
    environment: environment.value,
    username: username.value.trim(),
    password: password.value,
    url: url.value.trim(),
    notes: notes.value.trim(),
    isFavorite: isFavorite.value,
  });
}

function openUrl() {
  const value = url.value.trim();
  if (!value) return;
  const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  window.open(href, "_blank", "noopener,noreferrer");
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="open && draft"
        class="fixed inset-0 z-50 flex justify-end"
        data-testid="credential-drawer"
      >
        <button
          type="button"
          class="absolute inset-0 bg-overlay backdrop-blur-[2px]"
          aria-label="关闭"
          @click="emit('close')"
        />

        <aside
          class="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface-0 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-label="凭据编辑"
          @keydown="onKeydown"
        >
      <header class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div class="min-w-0">
          <h2 class="text-sm font-medium">{{ heading }}</h2>
          <p class="mt-0.5 text-[10px] text-muted">凭据保存在本地加密库</p>
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="focus-ring rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
            :class="isFavorite ? 'text-paw' : ''"
            :aria-pressed="isFavorite"
            title="收藏"
            data-testid="credential-favorite-toggle"
            @click="isFavorite = !isFavorite"
          >
            <Star :size="16" :fill="isFavorite ? 'currentColor' : 'none'" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="focus-ring rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
            aria-label="关闭"
            @click="emit('close')"
          >
            <X :size="16" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div class="space-y-4">
          <label class="block space-y-1.5">
            <span class="text-xs text-muted">名称 *</span>
            <Input v-model="title" placeholder="如：生产 MySQL" data-testid="credential-title" />
          </label>

          <label class="block space-y-1.5">
            <span class="text-xs text-muted">环境 *</span>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                v-for="env in CREDENTIAL_ENVIRONMENTS"
                :key="env.value"
                type="button"
                class="focus-ring rounded-md border px-2 py-1.5 text-xs transition-colors"
                :class="
                  environment === env.value
                    ? 'border-paw bg-paw-muted text-[var(--color-text)]'
                    : 'border-border text-muted hover:bg-surface-2'
                "
                :data-testid="`credential-env-${env.value}`"
                @click="environment = env.value"
              >
                {{ env.label }}
              </button>
            </div>
          </label>

          <label class="block space-y-1.5">
            <span class="text-xs text-muted">分类</span>
            <select v-model="category" class="input-field focus-ring w-full" data-testid="credential-category">
              <option v-for="cat in CREDENTIAL_CATEGORIES" :key="cat.value" :value="cat.value">
                {{ cat.label }}
              </option>
            </select>
          </label>

          <label class="block space-y-1.5">
            <span class="text-xs text-muted">用户名</span>
            <Input v-model="username" placeholder="登录账号" autocomplete="off" />
          </label>

          <label class="block space-y-1.5">
            <span class="text-xs text-muted">密码</span>
            <div class="relative">
              <Input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="登录密码"
                autocomplete="new-password"
                class="pr-9"
              />
              <button
                type="button"
                class="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-[var(--color-text)]"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="togglePasswordVisibility"
              >
                <EyeOff v-if="showPassword" :size="14" aria-hidden="true" />
                <Eye v-else :size="14" aria-hidden="true" />
              </button>
            </div>
          </label>

          <label class="block space-y-1.5">
            <span class="text-xs text-muted">地址</span>
            <div class="flex gap-2">
              <Input v-model="url" placeholder="https:// 或 host:port" class="min-w-0 flex-1" />
              <Btn variant="secondary" size="sm" :disabled="!url.trim()" @click="openUrl">打开</Btn>
            </div>
          </label>

          <label class="block space-y-1.5">
            <span class="text-xs text-muted">备注</span>
            <textarea
              v-model="notes"
              rows="3"
              class="input-field focus-ring w-full resize-none"
              placeholder="端口、VPN 说明等"
            />
          </label>
        </div>
      </div>

      <footer class="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
        <Btn
          v-if="editingId"
          variant="ghost"
          size="sm"
          class="!text-danger"
          data-testid="credential-delete"
          @click="emit('delete')"
        >
          删除
        </Btn>
        <span v-else />
        <div class="flex gap-2">
          <Btn variant="ghost" size="sm" @click="emit('close')">取消</Btn>
          <Btn
            variant="primary"
            size="sm"
            :disabled="!canSave"
            data-testid="credential-save"
            @click="handleSave"
          >
            保存
          </Btn>
        </div>
      </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}
</style>
