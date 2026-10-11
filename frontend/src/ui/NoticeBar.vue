<script setup lang="ts">
import { computed } from "vue";
import X from "~icons/lucide/x";

import { noticeCloseLabel, noticeText, type Notice } from "./noticeText";

const props = defineProps<{ notices: readonly Notice[] }>();
const emit = defineEmits<{ close: [path: string] }>();

const rows = computed(() =>
  props.notices.map((notice) => ({
    path: notice.path,
    text: noticeText(notice),
    closeLabel: noticeCloseLabel(notice.path),
  })),
);
</script>

<template>
  <ul role="status" class="shrink-0 border-b border-info-border bg-info text-fg">
    <li v-for="row in rows" :key="row.path" class="flex items-start gap-2 px-3 py-2">
      <p class="min-w-0 flex-1 wrap-break-word">{{ row.text }}</p>
      <button
        type="button"
        title="Close"
        :aria-label="row.closeLabel"
        class="rounded p-0.5 hover:bg-info-border"
        @click="emit('close', row.path)"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </li>
  </ul>
</template>
