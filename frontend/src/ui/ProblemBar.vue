<script setup lang="ts">
import { computed } from "vue";
import X from "~icons/lucide/x";

import { problemText } from "./problemText";
import type { Problem } from "./store";

const props = defineProps<{ problem: Problem }>();
const emit = defineEmits<{ close: [] }>();

const text = computed(() => problemText(props.problem));
</script>

<template>
  <div
    role="alert"
    class="flex shrink-0 items-start gap-2 border-b border-problem-border bg-problem px-3 py-2 text-fg"
  >
    <p class="min-w-0 flex-1 wrap-break-word whitespace-pre-line">{{ text }}</p>
    <button
      type="button"
      title="Close"
      aria-label="Close"
      class="rounded p-0.5 hover:bg-problem-border"
      @click="emit('close')"
    >
      <X class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
