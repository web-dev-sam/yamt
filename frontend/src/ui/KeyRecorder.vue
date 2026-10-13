<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { computed, nextTick, onMounted, shallowRef, useTemplateRef } from "vue";
import Plus from "~icons/lucide/plus";
import TriangleAlert from "~icons/lucide/triangle-alert";

import {
  KEY_ACTIONS,
  keyLabel,
  keyOfEvent,
  sameKey,
  type Key,
  type KeyAction,
  type KeyBindings,
} from "../ipc";
import { ACTION_NAMES, setKeyMenu, usedByText } from "./keyText";

const props = defineProps<{ action: KeyAction; initial: Key | null; bindings: KeyBindings }>();
const emit = defineEmits<{ record: [key: Key]; close: [] }>();

const MENU_STEPS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const field = useTemplateRef<HTMLInputElement>("field");
const plusButton = useTemplateRef<HTMLButtonElement>("plusButton");
const plusMenu = useTemplateRef<HTMLUListElement>("plusMenu");
const shown = shallowRef<Key | null>(props.initial);
const plusOpen = shallowRef(false);
const setKeys = setKeyMenu(navigator.platform);

const shownText = computed(() =>
  shown.value === null ? "" : keyLabel(shown.value, navigator.platform),
);
const owners = computed(() => {
  const key = shown.value;
  return key === null
    ? []
    : KEY_ACTIONS.filter(
        (other) =>
          other !== props.action && props.bindings[other].some((held) => sameKey(held, key)),
      );
});

onClickOutside(
  plusMenu,
  () => {
    plusOpen.value = false;
  },
  { ignore: [plusButton] },
);

onMounted(() => {
  dialog.value?.showModal();
  field.value?.focus();
});

function confirm(): void {
  if (shown.value !== null) {
    emit("record", shown.value);
  }
}

function cancel(event: Event): void {
  event.preventDefault();
  emit("close");
}

// ShortcutTextField.processKeyEvent: plain Escape and (with a key shown) plain Enter go to the
// dialog, a modifier alone changes nothing, every other key with its modifiers replaces the shown one.
function recordKey(event: KeyboardEvent): void {
  const modified = event.ctrlKey || event.metaKey || event.altKey;
  if (event.key === "Tab" && !modified) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const plain = !modified && !event.shiftKey;
  if (plain && event.key === "Escape") {
    emit("close");
    return;
  }
  if (plain && event.key === "Enter" && shown.value !== null) {
    confirm();
    return;
  }
  const key = keyOfEvent(event, navigator.platform);
  if (key !== null) {
    shown.value = key;
  }
}

async function togglePlus(): Promise<void> {
  plusOpen.value = !plusOpen.value;
  await nextTick();
  plusMenu.value?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
}

function closePlus(): void {
  plusOpen.value = false;
  field.value?.focus();
}

function setKey(key: Key): void {
  shown.value = key;
  closePlus();
}

function plusMenuKey(event: KeyboardEvent): void {
  if (event.key === "Escape" || event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    closePlus();
    return;
  }
  const step = MENU_STEPS[event.key];
  const items = [...(plusMenu.value?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
  if (step === undefined || items.length === 0) {
    return;
  }
  event.preventDefault();
  const index = items.findIndex((item) => item === event.target);
  items[(index + step + items.length) % items.length]?.focus();
}
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="key-dialog-title"
    class="m-auto w-[22rem] overflow-visible rounded-lg border border-control-border bg-panel text-fg"
    @cancel="cancel"
  >
    <h2 id="key-dialog-title" class="border-b border-control-border px-4 py-2 font-semibold">
      Keyboard Shortcut
    </h2>
    <div class="px-4 pt-3">
      <p class="mb-2">{{ ACTION_NAMES[action] }}</p>
      <div class="relative">
        <input
          ref="field"
          type="text"
          readonly
          aria-label="Keyboard shortcut"
          :value="shownText"
          class="w-full rounded border border-control-border bg-panel-inline py-1 pr-9 pl-2 caret-transparent outline-none focus:border-primary"
          @keydown="recordKey"
        />
        <button
          ref="plusButton"
          type="button"
          title="Set a key the field cannot record"
          aria-label="Set a key the field cannot record"
          aria-haspopup="menu"
          :aria-expanded="plusOpen"
          class="absolute inset-y-0.5 right-0.5 rounded px-1.5 hover:bg-hover"
          @click="togglePlus"
        >
          <Plus class="size-4" aria-hidden="true" />
        </button>
        <ul
          v-if="plusOpen"
          ref="plusMenu"
          role="menu"
          aria-label="Set a key"
          class="absolute top-full right-0 z-10 mt-1 min-w-36 rounded border border-control-border bg-panel py-1"
          @keydown="plusMenuKey"
        >
          <li v-for="entry in setKeys" :key="entry.label" role="none">
            <button
              type="button"
              role="menuitem"
              class="w-full px-3 py-1 text-left outline-none hover:bg-hover focus:bg-row-selected"
              @click="setKey(entry.key)"
            >
              {{ entry.label }}
            </button>
          </li>
        </ul>
      </div>
      <p role="status" class="mt-2 flex min-h-6 items-start gap-1.5">
        <template v-if="owners.length > 0">
          <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {{ usedByText(owners) }}
        </template>
      </p>
    </div>
    <div class="flex justify-end gap-2 px-4 pt-2 pb-4">
      <button
        type="button"
        :disabled="shown === null"
        class="rounded border border-primary bg-primary px-3.5 py-1 text-on-primary hover:brightness-110 disabled:border-control-border disabled:bg-transparent disabled:text-fg-muted disabled:hover:brightness-100"
        @click="confirm"
      >
        OK
      </button>
      <button
        type="button"
        class="rounded border border-control-border px-3.5 py-1 hover:bg-hover"
        @click="emit('close')"
      >
        Cancel
      </button>
    </div>
  </dialog>
</template>
