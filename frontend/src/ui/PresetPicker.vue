<script setup lang="ts">
import { useTemplateRef } from "vue";

import { presetChoices, type PresetChoice } from "../lsp";
import { addedServerFields } from "./serverSetup";
import { FROM_THE_LIST } from "./serverText";
import { useDropdownMenu } from "./useDropdownMenu";

const emit = defineEmits<{ pick: [choice: PresetChoice] }>();

const CHOICES = presetChoices();

const opener = useTemplateRef<HTMLButtonElement>("opener");
const menu = useTemplateRef<HTMLUListElement>("menu");
const { openFor, above, toggle, close, menuKey } = useDropdownMenu<"presets">({
  menu: () => menu.value,
  opener: () => opener.value,
});

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
      :aria-expanded="openFor !== null"
      class="rounded border border-control-border px-3.5 py-1 hover:bg-hover aria-expanded:bg-row-selected"
      @click="toggle('presets')"
    >
      {{ FROM_THE_LIST }}
    </button>
    <ul
      v-if="openFor !== null"
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
            addedServerFields(choice).command
          }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
