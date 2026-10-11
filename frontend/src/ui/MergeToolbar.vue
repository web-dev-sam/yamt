<script setup lang="ts">
import { computed, type Component } from "vue";
import ChevronsLeft from "~icons/lucide/chevrons-left";
import ChevronsRight from "~icons/lucide/chevrons-right";
import Redo2 from "~icons/lucide/redo-2";
import Undo2 from "~icons/lucide/undo-2";

import { finishMustAsk } from "./question";
import { summaryLabel } from "./summaryLabel";
import type { MergeSummary } from "./useMergeController";

type IconButton = { readonly label: string; readonly icon: Component; readonly run: () => void };

const props = defineProps<{ summary: MergeSummary | null }>();
const emit = defineEmits<{
  applyLeft: [];
  applyRight: [];
  undo: [];
  redo: [];
  finish: [];
}>();

const ICON_BUTTONS: readonly IconButton[] = [
  {
    label: "Apply non-conflicting changes from the left",
    icon: ChevronsRight,
    run: () => {
      emit("applyLeft");
    },
  },
  {
    label: "Apply non-conflicting changes from the right",
    icon: ChevronsLeft,
    run: () => {
      emit("applyRight");
    },
  },
  {
    label: "Undo",
    icon: Undo2,
    run: () => {
      emit("undo");
    },
  },
  {
    label: "Redo",
    icon: Redo2,
    run: () => {
      emit("redo");
    },
  },
];

const remaining = computed(() => (props.summary === null ? "" : summaryLabel(props.summary)));
const nothingLeft = computed(() => props.summary !== null && !finishMustAsk(props.summary));
</script>

<template>
  <header class="flex h-10 shrink-0 items-center gap-1 border-b border-separator bg-window px-2">
    <button
      type="button"
      :disabled="summary === null"
      class="mr-2 rounded border px-3.5 py-1"
      :class="
        nothingLeft
          ? 'border-primary bg-primary text-on-primary hover:brightness-110'
          : 'border-control-border hover:bg-hover'
      "
      @click="emit('finish')"
    >
      Mark resolved
    </button>
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
      <component :is="button.icon" class="size-4" aria-hidden="true" />
    </button>
    <span class="ml-3 text-fg-muted" role="status">{{ remaining }}</span>
  </header>
</template>
