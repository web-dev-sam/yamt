<script setup lang="ts">
import Send from "~icons/lucide/send";

import { useRangeStore } from "./rangeStore";

const { gitlab } = useRangeStore();
const { sendButton } = gitlab;

function send(): void {
  void gitlab.send();
}
</script>

<template>
  <span :title="sendButton.title" class="shrink-0">
    <button
      type="button"
      :disabled="sendButton.disabled"
      :title="sendButton.title"
      class="flex items-center gap-1.5 rounded border border-control-border px-2.5 py-1 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
      @mousedown.prevent
      @click="send"
    >
      <Send class="size-4" aria-hidden="true" />
      {{ sendButton.label }}
    </button>
  </span>
</template>
