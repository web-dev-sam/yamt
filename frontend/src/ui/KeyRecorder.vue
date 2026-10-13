<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { computed, nextTick, onMounted, shallowRef, useTemplateRef } from "vue";
import Plus from "~icons/lucide/plus";
import TriangleAlert from "~icons/lucide/triangle-alert";

import { keyLabel, type Key, type KeyAction, type KeyBindings } from "../ipc";
import { fieldKey } from "./keyField";
import { keyOwners } from "./keymapEdit";
import { ACTION_NAMES, setKeyMenu, usedByText } from "./keyText";
import { stepMenuItem } from "./menuKeys";

const props = defineProps<{ action: KeyAction; initial: Key | null; bindings: KeyBindings }>();
const emit = defineEmits<{ record: [key: Key]; close: [] }>();

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
const owners = computed(() =>
  shown.value === null ? [] : keyOwners(props.bindings, props.action, shown.value),
);

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

function recordKey(event: KeyboardEvent): void {
  const decision = fieldKey(event, shown.value, navigator.platform);
  if (decision.kind === "leave") {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  switch (decision.kind) {
    case "cancel":
      emit("close");
      return;
    case "confirm":
      emit("record", decision.key);
      return;
    case "record":
      shown.value = decision.key;
      return;
    case "ignore":
      return;
    default: {
      const _exhaustive: never = decision;
      return _exhaustive;
    }
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
  const items = [...(plusMenu.value?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
  const step = stepMenuItem(
    { count: items.length, focused: items.findIndex((item) => item === event.target) },
    event,
  );
  switch (step.kind) {
    case "close":
      event.preventDefault();
      event.stopPropagation();
      closePlus();
      return;
    case "focus":
      event.preventDefault();
      items[step.index]?.focus();
      return;
    case "ignore":
      return;
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
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
