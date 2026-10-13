<script setup lang="ts">
import { computed, shallowRef, type Component } from "vue";
import ArrowDown from "~icons/lucide/arrow-down";
import ArrowUp from "~icons/lucide/arrow-up";
import ChevronsLeft from "~icons/lucide/chevrons-left";
import ChevronsRight from "~icons/lucide/chevrons-right";
import Redo2 from "~icons/lucide/redo-2";
import Undo2 from "~icons/lucide/undo-2";

import type { Point } from "./menuPosition";
import { finishMustAsk } from "./question";
import SettingsButton from "./SettingsButton.vue";
import { useAppStore } from "./store";
import { summaryLabel } from "./summaryLabel";
import { TOOLBAR_BUTTONS, type ToolbarButtonId } from "./toolbarButtons";
import ToolbarMenu from "./ToolbarMenu.vue";
import type { Direction, MergeSummary } from "./useMergeController";

type IconButton = {
  readonly label: string;
  readonly icon: Component;
  readonly keepsKeyboard: boolean;
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

const SECONDARY_BUTTON = 2;

const ICON_BUTTONS: Readonly<Record<ToolbarButtonId, IconButton>> = {
  previous: {
    label: "Previous change",
    icon: ArrowUp,
    keepsKeyboard: true,
    run: () => {
      emit("move", "up");
    },
  },
  next: {
    label: "Next change",
    icon: ArrowDown,
    keepsKeyboard: true,
    run: () => {
      emit("move", "down");
    },
  },
  applyLeft: {
    label: "Apply non-conflicting changes from the left",
    icon: ChevronsRight,
    keepsKeyboard: false,
    run: () => {
      emit("applyLeft");
    },
  },
  applyRight: {
    label: "Apply non-conflicting changes from the right",
    icon: ChevronsLeft,
    keepsKeyboard: false,
    run: () => {
      emit("applyRight");
    },
  },
  undo: {
    label: "Undo",
    icon: Undo2,
    keepsKeyboard: false,
    run: () => {
      emit("undo");
    },
  },
  redo: {
    label: "Redo",
    icon: Redo2,
    keepsKeyboard: false,
    run: () => {
      emit("redo");
    },
  },
};

const { hiddenButtons } = useAppStore();
const menuAt = shallowRef<Point | null>(null);

const shownButtons = computed(() =>
  TOOLBAR_BUTTONS.filter((id) => !hiddenButtons.value.has(id)).map((id) => ({
    id,
    ...ICON_BUTTONS[id],
  })),
);
const remaining = computed(() => (props.summary === null ? "" : summaryLabel(props.summary)));
const nothingLeft = computed(() => props.summary !== null && !finishMustAsk(props.summary));

function pressed(button: IconButton, event: MouseEvent): void {
  if (button.keepsKeyboard) {
    event.preventDefault();
  }
}

function barPressed(event: MouseEvent): void {
  if (event.button === SECONDARY_BUTTON) {
    event.preventDefault();
  }
}

function openMenu(event: MouseEvent): void {
  menuAt.value = { x: event.clientX, y: event.clientY };
}
</script>

<template>
  <header
    class="flex h-10 shrink-0 items-center gap-1 px-2"
    @mousedown="barPressed"
    @contextmenu.prevent="openMenu"
  >
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
      v-for="button in shownButtons"
      :key="button.id"
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
    <ToolbarMenu
      v-if="menuAt !== null"
      :at="menuAt"
      :buttons="ICON_BUTTONS"
      @close="menuAt = null"
    />
  </header>
</template>
