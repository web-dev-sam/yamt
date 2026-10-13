<script setup lang="ts">
import { nextTick, onMounted, useTemplateRef } from "vue";
import ArrowLeft from "~icons/lucide/arrow-left";

import { useAppStore } from "./store";

const { closeSettings } = useAppStore();
const back = useTemplateRef<HTMLButtonElement>("back");
const focusedBefore = document.activeElement;

onMounted(() => {
  back.value?.focus();
});

async function goBack(): Promise<void> {
  closeSettings();
  await nextTick();
  if (
    focusedBefore instanceof HTMLElement &&
    focusedBefore.isConnected &&
    getComputedStyle(focusedBefore).visibility === "visible"
  ) {
    focusedBefore.focus();
  }
}
</script>

<template>
  <section
    aria-label="Settings"
    class="col-start-1 row-start-1 min-h-0 min-w-0 overflow-y-auto rounded-island bg-panel"
  >
    <div class="mx-auto w-full max-w-3xl p-6">
      <button
        ref="back"
        type="button"
        class="flex items-center gap-1.5 rounded border border-control-border px-3.5 py-1 hover:bg-hover"
        @click="goBack"
      >
        <ArrowLeft class="size-4" aria-hidden="true" />
        Back
      </button>
    </div>
  </section>
</template>
