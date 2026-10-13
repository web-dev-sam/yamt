<script setup lang="ts">
import { computed, type Component } from "vue";
import ArrowDown from "~icons/lucide/arrow-down";
import ArrowUp from "~icons/lucide/arrow-up";
import ChevronsLeft from "~icons/lucide/chevrons-left";
import ChevronsRight from "~icons/lucide/chevrons-right";
import Redo2 from "~icons/lucide/redo-2";
import Undo2 from "~icons/lucide/undo-2";

import { finishMustAsk } from "./question";
import SettingsButton from "./SettingsButton.vue";
import { summaryLabel } from "./summaryLabel";
import type { Direction, MergeSummary } from "./useMergeController";

type IconButton = {
  readonly label: string;
  readonly icon: Component;
  readonly keepsKeyboard: boolean;
  readonly history: boolean;
  readonly run: () => void;
};

const props = defineProps<{ summary: MergeSummary | null }>();
const emit = defineEmits<{
  move: [direction: Direction];
  applyLeft: [];
  applyRight: [];
  undo: [];
  redo: [];
  finish: [];
}>();

// The owner hid Undo and Redo for now (board item 662); their keys still work.
const HISTORY_BUTTONS_SHOWN = false;

const ICON_BUTTONS: readonly IconButton[] = [
  {
    label: "Previous change",
    icon: ArrowUp,
    keepsKeyboard: true,
    history: false,
    run: () => {
      emit("move", "up");
    },
  },
  {
    label: "Next change",
    icon: ArrowDown,
    keepsKeyboard: true,
    history: false,
    run: () => {
      emit("move", "down");
    },
  },
  {
    label: "Apply non-conflicting changes from the left",
    icon: ChevronsRight,
    keepsKeyboard: false,
    history: false,
    run: () => {
      emit("applyLeft");
    },
  },
  {
    label: "Apply non-conflicting changes from the right",
    icon: ChevronsLeft,
    keepsKeyboard: false,
    history: false,
    run: () => {
      emit("applyRight");
    },
  },
  {
    label: "Undo",
    icon: Undo2,
    keepsKeyboard: false,
    history: true,
    run: () => {
      emit("undo");
    },
  },
  {
    label: "Redo",
    icon: Redo2,
    keepsKeyboard: false,
    history: true,
    run: () => {
      emit("redo");
    },
  },
];
const SHOWN_BUTTONS = ICON_BUTTONS.filter(({ history }) => HISTORY_BUTTONS_SHOWN || !history);

const remaining = computed(() => (props.summary === null ? "" : summaryLabel(props.summary)));
const nothingLeft = computed(() => props.summary !== null && !finishMustAsk(props.summary));

function pressed(button: IconButton, event: MouseEvent): void {
  if (button.keepsKeyboard) {
    event.preventDefault();
  }
}
</script>

<template>
  <header class="flex h-10 shrink-0 items-center gap-1 px-2">
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
      v-for="button in SHOWN_BUTTONS"
      :key="button.label"
      type="button"
      :title="button.label"
      :aria-label="button.label"
      :disabled="summary === null"
      class="rounded p-1.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
      @mousedown="pressed(button, $event)"
      @click="button.run"
    >
      <component :is="button.icon" class="size-4" aria-hidden="true" />
    </button>
    <span class="ml-3 text-fg-muted" role="status">{{ remaining }}</span>
    <SettingsButton class="ml-auto" />
  </header>
</template>
