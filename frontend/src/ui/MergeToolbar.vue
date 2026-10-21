<script setup lang="ts">
import { computed, nextTick, shallowRef, type Component, type Ref } from "vue";
import ArrowDown from "~icons/lucide/arrow-down";
import ArrowUp from "~icons/lucide/arrow-up";
import ChevronsDownUp from "~icons/lucide/chevrons-down-up";
import ChevronsLeft from "~icons/lucide/chevrons-left";
import ChevronsRight from "~icons/lucide/chevrons-right";
import GitPullRequestClosed from "~icons/lucide/git-pull-request-closed";
import Redo2 from "~icons/lucide/redo-2";
import Undo2 from "~icons/lucide/undo-2";

import type { Point } from "./menuPosition";
import OperationButtons from "./OperationButtons.vue";
import { finishMustAsk } from "./question";
import ServerStatus from "./ServerStatus.vue";
import SettingsButton from "./SettingsButton.vue";
import { useAppStore } from "./store";
import { summaryLabel } from "./summaryLabel";
import { shownButtons, type IconButtonId } from "./toolbarButtons";
import ToolbarMenu from "./ToolbarMenu.vue";
import type { Direction, MergeSummary, ProblemCounts } from "./useMergeController";

type IconButton = {
  readonly icon: Component;
  readonly keepsKeyboard: boolean;
  readonly run: () => void;
  readonly selected: Readonly<Ref<boolean>> | null;
  readonly disabled: Readonly<Ref<boolean>>;
};

const props = defineProps<{
  summary: MergeSummary | null;
  path: string;
  problems: ProblemCounts | null;
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

const { hiddenButtons, collapsing, toggleCollapsing, abortState, abortOperation } = useAppStore();

const menuAt = shallowRef<Point | null>(null);

const noSummary = computed(() => props.summary === null);
const abortRunning = computed(() => abortState.value.kind === "running");

const ICON_BUTTONS: Readonly<Record<IconButtonId, IconButton>> = {
  abortMerge: {
    icon: GitPullRequestClosed,
    keepsKeyboard: true,
    run: () => {
      void abortKeepingKeyboard();
    },
    selected: null,
    disabled: abortRunning,
  },
  previous: {
    icon: ArrowUp,
    keepsKeyboard: true,
    run: () => {
      emit("move", "up");
    },
    selected: null,
    disabled: noSummary,
  },
  next: {
    icon: ArrowDown,
    keepsKeyboard: true,
    run: () => {
      emit("move", "down");
    },
    selected: null,
    disabled: noSummary,
  },
  collapse: {
    icon: ChevronsDownUp,
    keepsKeyboard: true,
    run: toggleCollapsing,
    selected: collapsing,
    disabled: noSummary,
  },
  applyLeft: {
    icon: ChevronsRight,
    keepsKeyboard: false,
    run: () => {
      emit("applyLeft");
    },
    selected: null,
    disabled: noSummary,
  },
  applyRight: {
    icon: ChevronsLeft,
    keepsKeyboard: false,
    run: () => {
      emit("applyRight");
    },
    selected: null,
    disabled: noSummary,
  },
  undo: {
    icon: Undo2,
    keepsKeyboard: false,
    run: () => {
      emit("undo");
    },
    selected: null,
    disabled: noSummary,
  },
  redo: {
    icon: Redo2,
    keepsKeyboard: false,
    run: () => {
      emit("redo");
    },
    selected: null,
    disabled: noSummary,
  },
};

const listed = computed(() => shownButtons(abortState.value, hiddenButtons.value));
const continueShown = computed(() => listed.value.some((button) => button.id === "continue"));
const shown = computed(() =>
  listed.value.flatMap((button) =>
    button.id === "continue" ? [] : [{ ...button, ...ICON_BUTTONS[button.id] }],
  ),
);
const remaining = computed(() => (props.summary === null ? "" : summaryLabel(props.summary)));
const nothingLeft = computed(() => props.summary !== null && !finishMustAsk(props.summary));

function pressed(button: IconButton, event: MouseEvent): void {
  if (button.keepsKeyboard) {
    event.preventDefault();
  }
}

// Removing an open modal <dialog> does not give focus back; only close() does (HTML, "dialog
// removing steps": https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element).
async function abortKeepingKeyboard(): Promise<void> {
  const before = document.activeElement;
  await abortOperation();
  await nextTick();
  if (document.activeElement === document.body && before instanceof HTMLElement) {
    before.focus();
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
    <OperationButtons v-if="continueShown" class="mr-2" :abort="false" />
    <button
      v-for="button in shown"
      :key="button.id"
      type="button"
      :title="button.label"
      :aria-label="button.label"
      :aria-pressed="button.selected?.value"
      :disabled="button.disabled.value"
      class="rounded p-1.5 hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted disabled:hover:bg-transparent aria-pressed:bg-row-selected aria-pressed:hover:brightness-110"
      @mousedown="pressed(button, $event)"
      @click="button.run"
    >
      <component :is="button.icon" class="size-4" aria-hidden="true" />
    </button>
    <span class="ml-3 text-fg-muted" role="status">{{ remaining }}</span>
    <ServerStatus class="ml-auto" :path="path" :problems="problems" />
    <SettingsButton />
    <ToolbarMenu v-if="menuAt !== null" :at="menuAt" @close="closeMenu" />
  </header>
</template>
