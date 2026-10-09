<script setup lang="ts">
import { computed } from "vue";

import type { MergeSummary } from "./useMergeController";

type IconButton = { readonly label: string; readonly path: string; readonly run: () => void };

const props = defineProps<{ summary: MergeSummary | null }>();
const emit = defineEmits<{
  applyLeft: [];
  applyRight: [];
  undo: [];
  redo: [];
  reset: [];
  finish: [];
}>();

const ICON_BUTTONS: readonly IconButton[] = [
  {
    label: "Apply non-conflicting changes from the left",
    path: "M3 4l4 4-4 4M9 4l4 4-4 4",
    run: () => {
      emit("applyLeft");
    },
  },
  {
    label: "Apply non-conflicting changes from the right",
    path: "M13 4l-4 4 4 4M7 4L3 8l4 4",
    run: () => {
      emit("applyRight");
    },
  },
  {
    label: "Undo",
    path: "M6 4L3 7l3 3M3 7h6.5a3.5 3.5 0 0 1 0 7H7",
    run: () => {
      emit("undo");
    },
  },
  {
    label: "Redo",
    path: "M10 4l3 3-3 3M13 7H6.5a3.5 3.5 0 0 0 0 7H9",
    run: () => {
      emit("redo");
    },
  },
];

const remaining = computed(() => {
  const summary = props.summary;
  if (summary === null) {
    return "";
  }
  const parts = [counted(summary.changes, "change"), counted(summary.conflicts, "conflict")].filter(
    (part) => part !== null,
  );
  return parts.length === 0 ? "All changes processed" : parts.join(" · ");
});

function counted(count: number, noun: string): string | null {
  if (count === 0) {
    return null;
  }
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}
</script>

<template>
  <header class="flex h-10 shrink-0 items-center gap-1 border-b border-separator bg-window px-2">
    <button
      v-for="button in ICON_BUTTONS"
      :key="button.label"
      type="button"
      :title="button.label"
      :aria-label="button.label"
      :disabled="summary === null"
      class="rounded p-1.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
      @click="button.run"
    >
      <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true">
        <path
          :d="button.path"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <span class="ml-3 text-fg-muted" role="status">{{ remaining }}</span>
    <div class="ml-auto flex gap-2">
      <button
        type="button"
        :disabled="summary === null"
        class="rounded border border-control-border px-3.5 py-1 hover:bg-hover"
        @click="emit('reset')"
      >
        Reset file
      </button>
      <button
        type="button"
        :disabled="summary === null"
        class="rounded border border-primary bg-primary px-3.5 py-1 text-on-primary hover:brightness-110"
        @click="emit('finish')"
      >
        Mark resolved
      </button>
    </div>
  </header>
</template>
