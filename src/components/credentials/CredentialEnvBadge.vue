<script setup lang="ts">
import type { CredentialEnvironment } from "../../types/credential";
import { getEnvironmentOption } from "../../constants/credentialEnvironments";

defineProps<{
  environment: CredentialEnvironment;
}>();
</script>

<template>
  <span
    class="credential-env-badge inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none"
    :class="getEnvironmentOption(environment).badgeClass"
  >
    {{ getEnvironmentOption(environment).label }}
  </span>
</template>

<style scoped>
.credential-env--test {
  background: color-mix(in srgb, var(--color-warning) 22%, transparent);
  color: var(--color-warning);
}

.credential-env--prod {
  background: color-mix(in srgb, var(--color-danger) 22%, transparent);
  color: var(--color-danger);
}

.credential-env--local {
  background: color-mix(in srgb, var(--color-secure) 18%, transparent);
  color: var(--color-secure);
}

.credential-env--public {
  background: color-mix(in srgb, var(--color-link) 18%, transparent);
  color: var(--color-link);
}
</style>
