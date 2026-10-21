<script setup lang="ts">
import { computed } from "vue";

import { abortLabel, continueLabel } from "./operationText";
import { useAppStore } from "./store";

defineProps<{ abort: boolean }>();

const { operation, continueState, continueHover, continueOperation, abortState, abortOperation } =
  useAppStore();

const continueText = computed(() =>
  operation.value === null ? "" : continueLabel(operation.value),
);
const abortText = computed(() => (operation.value === null ? "" : abortLabel(operation.value)));
const ready = computed(() => continueState.value === "ready");
</script>

<template>
  <div v-if="operation !== null" class="flex shrink-0 items-center gap-2">
    <span :title="continueHover ?? continueText">
      <button
        type="button"
        :disabled="!ready"
        class="rounded border px-3.5 py-1 disabled:pointer-events-none"
        :class="
          ready
            ? 'border-primary bg-primary text-on-primary hover:brightness-110'
            : 'border-control-border text-fg-muted'
        "
        @click="continueOperation"
      >
        {{ continueText }}
      </button>
    </span>
    <button
      v-if="abort"
      type="button"
      :disabled="abortState.kind !== 'ready'"
      class="rounded border border-control-border px-3.5 py-1 hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted"
      @click="abortOperation"
    >
      {{ abortText }}
    </button>
  </div>
</template>
