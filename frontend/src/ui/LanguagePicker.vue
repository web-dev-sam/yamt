<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import Check from "~icons/lucide/check";
import ChevronDown from "~icons/lucide/chevron-down";

import type { TabLanguage } from "../ipc";
import { languageLabel } from "./compareTabs";
import { languageNames } from "./useCompareController";
import { useDropdownMenu } from "./useDropdownMenu";

type Item = { readonly label: string; readonly language: TabLanguage };

const props = defineProps<{ language: TabLanguage; detected: string | null }>();
const emit = defineEmits<{ pick: [language: TabLanguage] }>();

const ITEMS: readonly Item[] = [
  { label: "Auto", language: { kind: "auto" } },
  ...languageNames().map((name): Item => ({ label: name, language: { kind: "picked", name } })),
];

const opener = useTemplateRef<HTMLButtonElement>("opener");
const menu = useTemplateRef<HTMLUListElement>("menu");
const { openFor, above, toggle, close, menuKey } = useDropdownMenu<"languages">({
  menu: () => menu.value,
  opener: () => opener.value,
});

const label = computed(() => languageLabel(props.language, props.detected));

function isCurrent({ language }: Item): boolean {
  const current = props.language;
  return language.kind === "picked" && current.kind === "picked"
    ? language.name === current.name
    : language.kind === current.kind;
}

async function pick(item: Item): Promise<void> {
  await close();
  emit("pick", item.language);
}
</script>

<template>
  <div class="relative">
    <button
      ref="opener"
      type="button"
      title="Language"
      aria-haspopup="menu"
      :aria-expanded="openFor !== null"
      class="flex items-center gap-1 rounded border border-control-border px-2.5 py-0.5 hover:bg-hover aria-expanded:bg-row-selected"
      @click="toggle('languages')"
    >
      {{ label }}
      <ChevronDown class="size-3.5" aria-hidden="true" />
    </button>
    <ul
      v-if="openFor !== null"
      ref="menu"
      role="menu"
      aria-label="Language"
      class="absolute left-0 z-10 max-h-[60vh] min-w-48 overflow-y-auto rounded border border-control-border bg-panel opaque-scroller py-1"
      :class="above ? 'bottom-full' : 'top-full'"
      @keydown="menuKey"
    >
      <li v-for="item in ITEMS" :key="item.label" role="none">
        <button
          type="button"
          role="menuitemcheckbox"
          :aria-checked="isCurrent(item)"
          class="flex w-full items-center gap-2 py-1 pr-3 pl-1.5 text-left whitespace-nowrap outline-none hover:bg-hover focus:bg-row-selected"
          @click="pick(item)"
        >
          <Check v-if="isCurrent(item)" class="size-4" aria-hidden="true" />
          <span v-else class="size-4" aria-hidden="true" />
          {{ item.label }}
        </button>
      </li>
    </ul>
  </div>
</template>
