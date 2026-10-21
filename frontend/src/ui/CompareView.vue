<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { computed, useTemplateRef } from "vue";
import ArrowDown from "~icons/lucide/arrow-down";
import ArrowUp from "~icons/lucide/arrow-up";

import type { TabEntry, TabLanguage } from "../ipc";
import { useCompareStore } from "./compareStore";
import LanguagePicker from "./LanguagePicker.vue";
import { compareColumns } from "./paneSplit";
import SettingsButton from "./SettingsButton.vue";
import { FORMAT_LANGUAGES, useCompareController } from "./useCompareController";

const props = defineProps<{ tab: TabEntry; shown: boolean }>();

const GRID_TEMPLATE_COLUMNS = compareColumns();
const NOT_FORMATTABLE = `Format covers ${FORMAT_LANGUAGES.join(" and ")} only`;

const left = useTemplateRef<HTMLDivElement>("left");
const right = useTemplateRef<HTMLDivElement>("right");
const strip = useTemplateRef<SVGSVGElement>("strip");
const { preferences, detected, question, setLanguage } = useCompareStore();
const { formatLanguage, format, moveToChange, historyKey } = useCompareController(
  props.tab.id,
  { left, right, strip },
  { preferences, language: () => props.tab.language },
);
useEventListener(window, "keydown", historyKeyInShownTab);

const detectedName = computed(() => detected.value.get(props.tab.id) ?? null);
const formatTitle = computed(() =>
  formatLanguage.value === null
    ? NOT_FORMATTABLE
    : `Format both columns as ${formatLanguage.value}`,
);

function pickLanguage(language: TabLanguage): void {
  void setLanguage(props.tab.id, language);
}

function historyKeyInShownTab(event: KeyboardEvent): void {
  if (props.shown && question.value === null) {
    historyKey(event);
  }
}
</script>

<template>
  <div
    class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col gap-island"
    :class="{ 'invisible [content-visibility:hidden]': !shown }"
  >
    <header class="flex h-10 shrink-0 items-center gap-1 px-2">
      <button
        type="button"
        :title="formatTitle"
        :disabled="formatLanguage === null"
        class="mr-2 rounded border border-control-border px-3.5 py-1 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
        @mousedown.prevent
        @click="format"
      >
        Format
      </button>
      <LanguagePicker
        class="mr-2"
        :language="tab.language"
        :detected="detectedName"
        @pick="pickLanguage"
      />
      <button
        type="button"
        title="Previous change"
        aria-label="Previous change"
        class="rounded p-1.5 hover:bg-hover"
        @mousedown.prevent
        @click="moveToChange('up')"
      >
        <ArrowUp class="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        title="Next change"
        aria-label="Next change"
        class="rounded p-1.5 hover:bg-hover"
        @mousedown.prevent
        @click="moveToChange('down')"
      >
        <ArrowDown class="size-4" aria-hidden="true" />
      </button>
      <SettingsButton class="ml-auto" />
    </header>
    <!-- Rounded without clipping: overflow hidden around the scrolling panes was slower in WebKitGTK (plan §2 #51); the 4 px inset keeps the pane corners inside the arc. -->
    <section
      class="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] rounded-island bg-panel px-1 pb-1"
      :style="{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS }"
    >
      <h2 class="col-start-1 row-start-1 border-b border-separator px-3 py-1.5 text-fg-muted">
        Left
      </h2>
      <div class="col-start-2 row-start-1 border-b border-separator" />
      <h2 class="col-start-3 row-start-1 border-b border-separator px-3 py-1.5 text-fg-muted">
        Right
      </h2>
      <div ref="left" class="col-start-1 row-start-2 min-h-0 min-w-0" />
      <!-- The strip and its border sit on their own layer: repainting them inside the window's layer on every scroll frame was slow in WebKitGTK (plan §2 #51). -->
      <div class="col-start-2 row-start-2 min-h-0 border-x border-separator will-change-transform">
        <svg ref="strip" aria-hidden="true" class="block h-full w-full" />
      </div>
      <div ref="right" class="col-start-3 row-start-2 min-h-0 min-w-0" />
    </section>
  </div>
</template>
