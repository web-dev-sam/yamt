<script setup lang="ts">
import X from "~icons/lucide/x";

import type { NoticeRow } from "./noticeText";

defineProps<{ rows: readonly NoticeRow[] }>();
const emit = defineEmits<{ close: [key: string] }>();
</script>

<template>
  <ul role="status" class="shrink-0 rounded-md border border-info-border bg-info text-on-info">
    <li v-for="row in rows" :key="row.key" class="flex items-start gap-2 px-3 py-2">
      <p class="min-w-0 flex-1 wrap-break-word">{{ row.text }}</p>
      <button
        type="button"
        title="Close"
        :aria-label="row.closeLabel"
        class="rounded p-0.5 hover:bg-info-border"
        @click="emit('close', row.key)"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </li>
  </ul>
</template>
