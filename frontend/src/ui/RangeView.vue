<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import ArrowDown from "~icons/lucide/arrow-down";
import ArrowUp from "~icons/lucide/arrow-up";

import type { RangeEntry, RangeSide } from "../ipc";
import { fileIcon } from "./fileIcon";
import { ACTION_NAMES } from "./keyText";
import PaneFrame from "./PaneFrame.vue";
import { compareColumns } from "./paneSplit";
import { useRangeStore } from "./rangeStore";
import { fileHeading, sideHeading } from "./rangeText";
import SettingsButton from "./SettingsButton.vue";
import { useRangeController } from "./useRangeController";

const props = defineProps<{
  file: RangeEntry;
  leftSide: RangeSide;
  rightSide: RangeSide;
  shown: boolean;
}>();

const GRID_TEMPLATE_COLUMNS = compareColumns();
const PREVIOUS = ACTION_NAMES["previous-change"];
const NEXT = ACTION_NAMES["next-change"];

const left = useTemplateRef<HTMLDivElement>("left");
const right = useTemplateRef<HTMLDivElement>("right");
const strip = useTemplateRef<SVGSVGElement>("strip");
const { preferences, question } = useRangeStore();
const { content, moveToChange } = useRangeController(
  props.file,
  { left, right, strip },
  { preferences },
);

const icon = computed(() => fileIcon(props.file.path));
const heading = computed(() => fileHeading(props.file));
const leftHeading = computed(() => sideHeading(props.leftSide));
const rightHeading = computed(() => sideHeading(props.rightSide));
const columns = computed(() => content.value.kind === "columns");
const note = computed(() => (content.value.kind === "columns" ? content.value.note : null));
const sentence = computed(() => (content.value.kind === "sentence" ? content.value.text : null));
</script>

<template>
  <PaneFrame :shown="shown" :asking="question !== null" :columns="GRID_TEMPLATE_COLUMNS">
    <template #header>
      <header class="flex h-10 shrink-0 items-center gap-1 px-2">
        <component :is="icon" class="ml-1 size-4 shrink-0" aria-hidden="true" />
        <h2 class="mr-2 ml-1 truncate font-semibold">{{ heading }}</h2>
        <span v-if="note !== null" class="mr-2 shrink-0 text-fg-muted">{{ note }}</span>
        <button
          type="button"
          :title="PREVIOUS"
          :aria-label="PREVIOUS"
          :disabled="!columns"
          class="rounded p-1.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
          @mousedown.prevent
          @click="moveToChange('up')"
        >
          <ArrowUp class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          :title="NEXT"
          :aria-label="NEXT"
          :disabled="!columns"
          class="rounded p-1.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
          @mousedown.prevent
          @click="moveToChange('down')"
        >
          <ArrowDown class="size-4" aria-hidden="true" />
        </button>
        <SettingsButton class="ml-auto" />
      </header>
    </template>
    <template #default="{ stripLayer }">
      <h3
        class="col-start-1 row-start-1 truncate border-b border-separator px-3 py-1.5 text-fg-muted"
        :title="leftSide.subject"
      >
        {{ leftHeading }}
      </h3>
      <div class="col-start-2 row-start-1 border-b border-separator" />
      <h3
        class="col-start-3 row-start-1 truncate border-b border-separator px-3 py-1.5 text-fg-muted"
        :title="rightSide.subject"
      >
        {{ rightHeading }}
      </h3>
      <template v-if="columns">
        <div ref="left" class="col-start-1 row-start-2 min-h-0 min-w-0" />
        <div class="col-start-2 row-start-2" :class="stripLayer">
          <svg ref="strip" aria-hidden="true" class="block h-full w-full" />
        </div>
        <div ref="right" class="col-start-3 row-start-2 min-h-0 min-w-0" />
      </template>
      <p v-else-if="sentence !== null" class="col-span-3 col-start-1 row-start-2 px-3 py-4">
        {{ sentence }}
      </p>
    </template>
  </PaneFrame>
</template>
