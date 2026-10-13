<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import ArrowLeft from "~icons/lucide/arrow-left";

import type { Antialiasing, Theme } from "../ipc";
import ChoiceButtons from "./ChoiceButtons.vue";
import KeymapList from "./KeymapList.vue";
import { showsAntialiasing } from "./settings";
import { useAppStore } from "./store";

const THEMES: readonly { readonly value: Theme; readonly label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const ANTIALIASINGS: readonly { readonly value: Antialiasing; readonly label: string }[] = [
  { value: "subpixel", label: "Subpixel" },
  { value: "greyscale", label: "Greyscale" },
];
const ON_LINUX = showsAntialiasing(navigator.platform);

const { settings, closeSettings, setTheme, setAntialiasing, moveSettings } = useAppStore();
const back = useTemplateRef<HTMLButtonElement>("back");
const pathText = shallowRef("");
const focusedBefore = document.activeElement;

const read = computed(() => settings.value.read);
const defaultInUse = computed(
  () => read.value === null || read.value.path === read.value.defaultPath,
);

watch(() => read.value?.path, restorePath, { immediate: true });

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

function restorePath(): void {
  pathText.value = read.value?.path ?? "";
}

async function moveToDefault(): Promise<void> {
  if (read.value !== null) {
    await moveSettings(read.value.defaultPath);
  }
}
</script>

<template>
  <section
    aria-label="Settings"
    class="col-start-1 row-start-1 min-h-0 min-w-0 overflow-y-auto rounded-island opaque-scroller"
  >
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <button
        ref="back"
        type="button"
        class="flex items-center gap-1.5 self-start rounded border border-control-border px-3.5 py-1 hover:bg-hover"
        @click="goBack"
      >
        <ArrowLeft class="size-4" aria-hidden="true" />
        Back
      </button>
      <section aria-labelledby="settings-theme">
        <h3 id="settings-theme" class="mb-2 font-semibold">Theme</h3>
        <ChoiceButtons :options="THEMES" :pressed="settings.theme" @pick="setTheme" />
      </section>
      <section v-if="ON_LINUX" aria-labelledby="settings-antialiasing">
        <h3 id="settings-antialiasing" class="mb-2 font-semibold">Antialiasing</h3>
        <ChoiceButtons
          :options="ANTIALIASINGS"
          :pressed="settings.antialiasing"
          @pick="setAntialiasing"
        />
        <p class="mt-1 text-fg-muted">Takes effect the next time yamt starts.</p>
      </section>
      <section aria-labelledby="settings-keymap">
        <h3 id="settings-keymap" class="mb-2 font-semibold">Keymap</h3>
        <KeymapList />
      </section>
      <section aria-labelledby="settings-file">
        <h3 id="settings-file" class="mb-2 font-semibold">Settings file</h3>
        <form class="flex gap-2" @submit.prevent="moveSettings(pathText)">
          <input
            v-model="pathText"
            type="text"
            aria-labelledby="settings-file"
            spellcheck="false"
            :disabled="read === null"
            class="min-w-0 flex-1 rounded border border-control-border bg-panel-inline px-2 py-1 font-mono outline-none focus:border-primary disabled:text-fg-muted"
            @keydown.esc="restorePath"
          />
          <button
            type="submit"
            :disabled="read === null"
            class="rounded border border-control-border px-3.5 py-1 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
          >
            Use
          </button>
          <button
            type="button"
            :disabled="defaultInUse"
            class="rounded border border-control-border px-3.5 py-1 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
            @click="moveToDefault"
          >
            Default
          </button>
        </form>
        <p class="mt-1 text-fg-muted">yamt reads this file again whenever its window gets focus.</p>
      </section>
    </div>
  </section>
</template>
