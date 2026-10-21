<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import ArrowDown from "~icons/lucide/arrow-down";
import ArrowUp from "~icons/lucide/arrow-up";

import type { TabEntry, TabLanguage } from "../ipc";
import CompareLanguagePicker from "./CompareLanguagePicker.vue";
import { useCompareStore } from "./compareStore";
import { ACTION_NAMES } from "./keyText";
import PaneFrame from "./PaneFrame.vue";
import { compareColumns } from "./paneSplit";
import SettingsButton from "./SettingsButton.vue";
import { FORMAT_LANGUAGES, useCompareController } from "./useCompareController";

const props = defineProps<{ tab: TabEntry; shown: boolean }>();

const GRID_TEMPLATE_COLUMNS = compareColumns();
const NOT_FORMATTABLE = `Format covers ${FORMAT_LANGUAGES.join(" and ")} only`;
const PREVIOUS = ACTION_NAMES["previous-change"];
const NEXT = ACTION_NAMES["next-change"];

const left = useTemplateRef<HTMLDivElement>("left");
const right = useTemplateRef<HTMLDivElement>("right");
const strip = useTemplateRef<SVGSVGElement>("strip");
const { preferences, detected, question, setLanguage } = useCompareStore();
const { formatLanguage, format, moveToChange, historyKey } = useCompareController(
  props.tab.id,
  { left, right, strip },
  { preferences, language: () => props.tab.language },
);

const detectedName = computed(() => detected.value.get(props.tab.id));
const formatTitle = computed(() =>
  formatLanguage.value === null
    ? NOT_FORMATTABLE
    : `Format both columns as ${formatLanguage.value}`,
);

function pickLanguage(language: TabLanguage): void {
  void setLanguage(props.tab.id, language);
}
</script>

<template>
  <PaneFrame
    :shown="shown"
    :asking="question !== null"
    :columns="GRID_TEMPLATE_COLUMNS"
    @shown-keydown="historyKey"
  >
    <template #header>
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
        <CompareLanguagePicker
          class="mr-2"
          :language="tab.language"
          :detected="detectedName"
          @pick="pickLanguage"
        />
        <button
          type="button"
          :title="PREVIOUS"
          :aria-label="PREVIOUS"
          class="rounded p-1.5 hover:bg-hover"
          @mousedown.prevent
          @click="moveToChange('up')"
        >
          <ArrowUp class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          :title="NEXT"
          :aria-label="NEXT"
          class="rounded p-1.5 hover:bg-hover"
          @mousedown.prevent
          @click="moveToChange('down')"
        >
          <ArrowDown class="size-4" aria-hidden="true" />
        </button>
        <SettingsButton class="ml-auto" />
      </header>
    </template>
    <template #default="{ stripLayer }">
      <h2 class="col-start-1 row-start-1 border-b border-separator px-3 py-1.5 text-fg-muted">
        Left
      </h2>
      <div class="col-start-2 row-start-1 border-b border-separator" />
      <h2 class="col-start-3 row-start-1 border-b border-separator px-3 py-1.5 text-fg-muted">
        Right
      </h2>
      <div ref="left" class="col-start-1 row-start-2 min-h-0 min-w-0" />
      <div class="col-start-2 row-start-2" :class="stripLayer">
        <svg ref="strip" aria-hidden="true" class="block h-full w-full" />
      </div>
      <div ref="right" class="col-start-3 row-start-2 min-h-0 min-w-0" />
    </template>
  </PaneFrame>
</template>
