<script setup lang="ts">
import { useTemplateRef } from "vue";
import Search from "~icons/lucide/search";
import X from "~icons/lucide/x";

import { CLEAR_SEARCH, SEARCH_FIELD_LABEL, SEARCH_FIELD_PLACEHOLDER } from "./mergeRequestsText";

const props = defineProps<{ text: string }>();
const emit = defineEmits<{ change: [text: string] }>();

const field = useTemplateRef<HTMLInputElement>("field");

function typed(event: Event): void {
  if (event.target instanceof HTMLInputElement) {
    emit("change", event.target.value);
  }
}

function fieldKey(event: KeyboardEvent): void {
  if (event.key === "Escape" && props.text !== "") {
    event.preventDefault();
    emit("change", "");
  }
}

function cleared(): void {
  emit("change", "");
  field.value?.focus();
}
</script>

<template>
  <div class="relative flex w-72 items-center">
    <Search class="pointer-events-none absolute left-2 size-4 text-fg-muted" aria-hidden="true" />
    <input
      ref="field"
      type="text"
      spellcheck="false"
      :value="text"
      :aria-label="SEARCH_FIELD_LABEL"
      :placeholder="SEARCH_FIELD_PLACEHOLDER"
      class="w-full rounded border border-control-border bg-panel py-1 pr-8 pl-8 outline-none focus:border-primary"
      @input="typed"
      @keydown="fieldKey"
    />
    <button
      v-if="text !== ''"
      type="button"
      :aria-label="CLEAR_SEARCH"
      class="absolute right-1 rounded p-0.5 hover:bg-hover"
      @mousedown.prevent
      @click="cleared"
    >
      <X class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
