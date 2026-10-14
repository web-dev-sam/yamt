<script setup lang="ts">
import { computed, shallowRef, type Component, type Ref } from "vue";
import ArrowDown from "~icons/lucide/arrow-down";
import ArrowUp from "~icons/lucide/arrow-up";
import ChevronsDownUp from "~icons/lucide/chevrons-down-up";
import ChevronsLeft from "~icons/lucide/chevrons-left";
import ChevronsRight from "~icons/lucide/chevrons-right";
import Redo2 from "~icons/lucide/redo-2";
import Undo2 from "~icons/lucide/undo-2";

import type { Point } from "./menuPosition";
import { finishMustAsk } from "./question";
import ServerStatus from "./ServerStatus.vue";
import SettingsButton from "./SettingsButton.vue";
import { useAppStore } from "./store";
import { summaryLabel } from "./summaryLabel";
import { TOOLBAR_BUTTONS, type ToolbarButtonId } from "./toolbarButtons";
import ToolbarMenu from "./ToolbarMenu.vue";
import type { Direction, MergeHandle, MergeSummary } from "./useMergeController";

type IconButton = {
  readonly label: string;
  readonly icon: Component;
  readonly keepsKeyboard: boolean;
  readonly run: () => void;
  readonly selected: Readonly<Ref<boolean>> | null;
};

const props = defineProps<{
  summary: MergeSummary | null;
  path: string;
  problems: MergeHandle["problems"]["value"];
}>();
const emit = defineEmits<{
  move: [direction: Direction];
  applyLeft: [];
  applyRight: [];
  undo: [];
  redo: [];
  finish: [];
}>();

const SECONDARY_BUTTON = 2;

const { hiddenButtons, collapsing, toggleCollapsing } = useAppStore();

const ICON_BUTTONS: Readonly<Record<ToolbarButtonId, IconButton>> = {
  previous: {
    label: "Previous change",
    icon: ArrowUp,
    keepsKeyboard: true,
    run: () => {
      emit("move", "up");
    },
    selected: null,
  },
  next: {
    label: "Next change",
    icon: ArrowDown,
    keepsKeyboard: true,
    run: () => {
      emit("move", "down");
    },
    selected: null,
  },
  collapse: {
    label: "Collapse unchanged fragments",
    icon: ChevronsDownUp,
    keepsKeyboard: true,
    run: toggleCollapsing,
    selected: collapsing,
  },
  applyLeft: {
    label: "Apply non-conflicting changes from the left",
    icon: ChevronsRight,
    keepsKeyboard: false,
    run: () => {
      emit("applyLeft");
    },
    selected: null,
  },
  applyRight: {
    label: "Apply non-conflicting changes from the right",
    icon: ChevronsLeft,
    keepsKeyboard: false,
    run: () => {
      emit("applyRight");
    },
    selected: null,
  },
  undo: {
    label: "Undo",
    icon: Undo2,
    keepsKeyboard: false,
    run: () => {
      emit("undo");
    },
    selected: null,
  },
  redo: {
    label: "Redo",
    icon: Redo2,
    keepsKeyboard: false,
    run: () => {
      emit("redo");
    },
    selected: null,
  },
};

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
  if (event.button === SECONDARY_BUTTON || event.ctrlKey) {
    event.preventDefault();
  }
}

function openMenu(event: MouseEvent): void {
  menuAt.value = { x: event.clientX, y: event.clientY };
}

function closeMenu(): void {
  menuAt.value = null;
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
      class="mr-2 rounded border px-3.5 py-1 disabled:pointer-events-none"
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
      :aria-pressed="button.selected?.value"
      :disabled="summary === null"
      class="rounded p-1.5 hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted disabled:hover:bg-transparent aria-pressed:bg-row-selected aria-pressed:hover:brightness-110"
      @mousedown="pressed(button, $event)"
      @click="button.run"
    >
      <component :is="button.icon" class="size-4" aria-hidden="true" />
    </button>
    <span class="ml-3 text-fg-muted" role="status">{{ remaining }}</span>
    <ServerStatus class="ml-auto" :path="path" :problems="problems" />
    <SettingsButton />
    <ToolbarMenu v-if="menuAt !== null" :at="menuAt" :buttons="ICON_BUTTONS" @close="closeMenu" />
  </header>
</template>
