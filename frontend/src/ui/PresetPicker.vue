<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { nextTick, shallowRef, useTemplateRef } from "vue";

import { presetChoices, type PresetChoice } from "../lsp";
import { stepMenuItem } from "./menuKeys";
import { FROM_THE_LIST } from "./serverText";

const emit = defineEmits<{ pick: [choice: PresetChoice] }>();

const CHOICES = presetChoices();

const opener = useTemplateRef<HTMLButtonElement>("opener");
const menu = useTemplateRef<HTMLUListElement>("menu");
const open = shallowRef(false);
const above = shallowRef(false);

onClickOutside(
  menu,
  () => {
    void closeAfterClick();
  },
  { ignore: [opener] },
);

async function close(): Promise<void> {
  open.value = false;
  await nextTick();
  opener.value?.focus();
}

async function closeAfterClick(): Promise<void> {
  const focused = document.activeElement;
  if (focused !== document.body && menu.value?.contains(focused) !== true) {
    open.value = false;
    return;
  }
  await close();
}

async function toggle(): Promise<void> {
  if (open.value) {
    await close();
    return;
  }
  open.value = true;
  above.value = false;
  await nextTick();
  const opened = menu.value;
  if (opened === null) {
    return;
  }
  above.value = opened.getBoundingClientRect().bottom > visibleBottom(opened);
  await nextTick();
  opened.querySelector<HTMLElement>("[role=menuitem]")?.focus();
}

function visibleBottom(element: HTMLElement): number {
  for (let box = element.parentElement; box !== null; box = box.parentElement) {
    if (getComputedStyle(box).overflowY !== "visible") {
      return box.getBoundingClientRect().bottom;
    }
  }
  return window.innerHeight;
}

function menuKey(event: KeyboardEvent): void {
  const items = [...(menu.value?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
  const step = stepMenuItem(
    { count: items.length, focused: items.findIndex((item) => item === event.target) },
    event,
  );
  switch (step.kind) {
    case "close":
      event.preventDefault();
      void close();
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

async function pick(choice: PresetChoice): Promise<void> {
  await close();
  emit("pick", choice);
}
</script>

<template>
  <div class="relative">
    <button
      ref="opener"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      class="rounded border border-control-border px-3.5 py-1 hover:bg-hover aria-expanded:bg-row-selected"
      @click="toggle"
    >
      {{ FROM_THE_LIST }}
    </button>
    <ul
      v-if="open"
      ref="menu"
      role="menu"
      :aria-label="FROM_THE_LIST"
      class="absolute left-0 z-10 min-w-72 rounded border border-control-border bg-panel py-1"
      :class="above ? 'bottom-full' : 'top-full'"
      @keydown="menuKey"
    >
      <li v-for="choice in CHOICES" :key="choice.name" role="none">
        <button
          type="button"
          role="menuitem"
          :aria-label="choice.name"
          class="flex w-full gap-6 px-3 py-1 text-left outline-none hover:bg-hover focus:bg-row-selected"
          @click="pick(choice)"
        >
          <span class="flex-1 whitespace-nowrap">{{ choice.name }}</span>
          <span class="font-mono whitespace-nowrap text-fg-muted">{{
            choice.command.join(" ")
          }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
