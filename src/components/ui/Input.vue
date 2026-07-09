<script setup lang="ts">
defineProps<{
  modelValue?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <input
    :value="modelValue"
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :disabled="disabled"
    :aria-label="ariaLabel"
    class="input-field focus-ring"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
