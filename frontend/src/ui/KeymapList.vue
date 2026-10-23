<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from "vue";

import { keyLabel, type Key, type KeyAction } from "../ipc";
import { isDefault } from "./keymapEdit";
import KeyRecorder from "./KeyRecorder.vue";
import {
  ACTION_NAMES,
  ACTION_PLACES,
  KEYMAP_GROUPS,
  keymapMenu,
  type KeymapCommand,
} from "./keyText";
import { ARROW_STEPS } from "./menuKeys";
import { useSettingsStore } from "./settingsStore";
import { useDropdownMenu } from "./useDropdownMenu";

type Recording = {
  readonly action: KeyAction;
  readonly from: Key | null;
  readonly initial: Key | null;
};

const { settings, addKey, changeKey, removeKey, removeAllKeys, resetKeys } = useSettingsStore();
const list = useTemplateRef<HTMLDivElement>("list");
const menu = useTemplateRef<HTMLUListElement[]>("menu");
const {
  openFor: menuFor,
  above: menuAbove,
  toggle: toggleMenu,
  close: closeMenu,
  menuKey,
} = useDropdownMenu<KeyAction>({
  menu: () => menu.value?.[0] ?? null,
  opener: rowOf,
});
const recording = shallowRef<Recording | null>(null);

const bindings = computed(() => settings.value.keys.bindings);
const groups = computed(() =>
  KEYMAP_GROUPS.map(({ title, actions }) => ({
    title,
    rows: actions.map((action) => {
      const keys = bindings.value[action];
      return {
        action,
        labels: keys.map((key) => keyLabel(key, navigator.platform)),
        changed: !isDefault(action, keys),
      };
    }),
  })),
);
const menuEntries = computed(() =>
  menuFor.value === null
    ? []
    : keymapMenu(menuFor.value, bindings.value[menuFor.value], navigator.platform),
);

function rowOf(action: KeyAction): HTMLElement | null {
  return list.value?.querySelector<HTMLElement>(`[data-keymap-row="${action}"]`) ?? null;
}

async function focusRow(action: KeyAction): Promise<void> {
  await nextTick();
  rowOf(action)?.focus();
}

function stepRow(event: KeyboardEvent): void {
  const step = ARROW_STEPS[event.key];
  const rows = [...(list.value?.querySelectorAll<HTMLElement>("[data-keymap-row]") ?? [])];
  if (step === undefined) {
    return;
  }
  event.preventDefault();
  rows[rows.findIndex((row) => row === event.currentTarget) + step]?.focus();
}

async function run(action: KeyAction, command: KeymapCommand): Promise<void> {
  await closeMenu();
  switch (command.kind) {
    case "add":
      recording.value = { action, from: null, initial: bindings.value[action][0] ?? null };
      return;
    case "change":
      recording.value = { action, from: command.key, initial: command.key };
      return;
    case "remove":
      await removeKey(action, command.key);
      return;
    case "removeAll":
      await removeAllKeys(action);
      return;
    case "reset":
      await resetKeys(action);
      return;
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

async function stopRecording(): Promise<Recording | null> {
  const done = recording.value;
  recording.value = null;
  if (done !== null) {
    await focusRow(done.action);
  }
  return done;
}

async function recorded(key: Key): Promise<void> {
  const done = await stopRecording();
  if (done === null) {
    return;
  }
  await (done.from === null ? addKey(done.action, key) : changeKey(done.action, done.from, key));
  if (document.activeElement === document.body) {
    await focusRow(done.action);
  }
}
</script>

<template>
  <div ref="list" class="flex flex-col gap-4">
    <section v-for="group in groups" :key="group.title" :aria-label="group.title">
      <h4 class="mb-1 text-fg-muted">{{ group.title }}</h4>
      <ul class="flex flex-col">
        <li v-for="row in group.rows" :key="row.action" class="relative">
          <button
            type="button"
            :data-keymap-row="row.action"
            aria-haspopup="menu"
            :aria-expanded="menuFor === row.action"
            class="flex w-full items-start gap-3 rounded px-2 py-1 text-left hover:bg-row-hover aria-expanded:bg-row-selected"
            @click="toggleMenu(row.action)"
            @keydown="stepRow"
          >
            <span class="min-w-0 flex-1">
              <span class="block" :class="{ 'text-primary': row.changed }">
                {{ ACTION_NAMES[row.action] }}
              </span>
              <span class="block text-fg-muted">{{ ACTION_PLACES[row.action] }}</span>
            </span>
            <span class="flex max-w-1/2 shrink-0 flex-wrap justify-end gap-1">
              <kbd
                v-for="label in row.labels"
                :key="label"
                class="rounded border border-control-border bg-panel-inline px-1.5 font-sans"
              >
                {{ label }}
              </kbd>
              <span v-if="row.labels.length === 0" class="text-fg-muted">None</span>
            </span>
          </button>
          <ul
            v-if="menuFor === row.action"
            ref="menu"
            role="menu"
            :aria-label="ACTION_NAMES[row.action]"
            class="absolute left-2 z-10 min-w-56 rounded border border-control-border bg-panel py-1"
            :class="menuAbove ? 'bottom-full' : 'top-full'"
            @keydown="menuKey"
          >
            <template v-for="(entry, index) in menuEntries" :key="index">
              <li
                v-if="entry.kind === 'separator'"
                role="separator"
                class="my-1 border-t border-control-border"
              />
              <li v-else role="none">
                <button
                  type="button"
                  role="menuitem"
                  class="w-full px-3 py-1 text-left outline-none hover:bg-hover focus:bg-row-selected"
                  @click="run(row.action, entry.command)"
                >
                  {{ entry.label }}
                </button>
              </li>
            </template>
          </ul>
        </li>
      </ul>
    </section>
    <KeyRecorder
      v-if="recording !== null"
      :action="recording.action"
      :initial="recording.initial"
      :bindings="bindings"
      @record="recorded"
      @close="stopRecording"
    />
  </div>
</template>
