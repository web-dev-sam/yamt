<script setup lang="ts">
import { computed, useTemplateRef, watch } from "vue";
import ArrowDown from "~icons/lucide/arrow-down";
import ArrowUp from "~icons/lucide/arrow-up";
import ChevronsDownUp from "~icons/lucide/chevrons-down-up";

import type { RangeEntry } from "../ipc";
import { COLLAPSE_LABEL } from "./collapsing";
import { fileIcon } from "./fileIcon";
import { ACTION_NAMES } from "./keyText";
import MergeRequestsButton from "./MergeRequestsButton.vue";
import PaneFrame from "./PaneFrame.vue";
import { compareColumns } from "./paneSplit";
import RangeColumnHeading from "./RangeColumnHeading.vue";
import RangeSendButton from "./RangeSendButton.vue";
import { useRangeStore } from "./rangeStore";
import {
  fileHeading,
  REVIEW_FROM_START_LABEL,
  REVIEWED_LABEL,
  reviewedCount,
  SINCE_REVIEW_HEADING,
  SINCE_REVIEW_NOTE,
  type ColumnNames,
} from "./rangeText";
import RangeThreadLayer from "./RangeThreadLayer.vue";
import SettingsButton from "./SettingsButton.vue";
import { takesSearchMove, useRangeController, type RangeViewKind } from "./useRangeController";
import { useSearchGoTo } from "./useSearchGoTo";

const props = defineProps<{
  file: RangeEntry;
  columns: ColumnNames;
  shown: boolean;
  view: RangeViewKind;
}>();

const GRID_TEMPLATE_COLUMNS = compareColumns();
const PREVIOUS = ACTION_NAMES["previous-change"];
const NEXT = ACTION_NAMES["next-change"];

const left = useTemplateRef<HTMLDivElement>("left");
const right = useTemplateRef<HTMLDivElement>("right");
const strip = useTemplateRef<SVGSVGElement>("strip");
const sentenceBox = useTemplateRef<HTMLParagraphElement>("sentenceBox");
const { preferences, question, collapsing, toggleCollapsing, search, reviewed } = useRangeStore();
const { marks, counted, busy } = reviewed;
const { content, threadHosts, sentenceFocusAsks, moveToChange, goTo } = useRangeController(
  props.file,
  { left, right, strip },
  { preferences, view: props.view },
);
useSearchGoTo(
  search,
  () => props.shown,
  () => props.file.path,
  searchGoTo,
);

const icon = computed(() => fileIcon(props.file.path));
const heading = computed(() => fileHeading(props.file));
const since = computed(() => props.view === "sinceReview");
const isColumns = computed(() => content.value.kind === "columns");
const note = computed(() => (content.value.kind === "columns" ? content.value.note : null));
const sentence = computed(() => (content.value.kind === "sentence" ? content.value.text : null));
const isReviewed = computed(() => marks.value.get(props.file.id) === "reviewed");
const reviewedLook = computed(() =>
  isReviewed.value
    ? "border-primary bg-primary text-on-primary hover:brightness-110"
    : "border-control-border hover:bg-hover",
);
const count = computed(() => reviewedCount(counted.value));

watch(
  sentenceFocusAsks,
  () => {
    sentenceBox.value?.focus();
  },
  { flush: "post" },
);

function searchGoTo(target: Parameters<typeof goTo>[0]): void {
  if (takesSearchMove(props.view, target.pane)) {
    goTo(target);
  }
}

function toggleReviewed(): void {
  void reviewed.toggle(props.file);
}

function reviewFromStart(): void {
  void reviewed.reviewFromStart(props.file);
}
</script>

<template>
  <PaneFrame :shown="shown" :asking="question !== null" :columns="GRID_TEMPLATE_COLUMNS">
    <template #header>
      <header class="flex h-10 shrink-0 items-center gap-1 px-2">
        <button
          type="button"
          :aria-pressed="isReviewed"
          :disabled="busy"
          class="mr-2 rounded border px-3.5 py-1 disabled:pointer-events-none disabled:border-control-border disabled:bg-transparent disabled:text-fg-muted"
          :class="reviewedLook"
          @mousedown.prevent
          @click="toggleReviewed"
        >
          {{ REVIEWED_LABEL }}
        </button>
        <component :is="icon" class="ml-1 size-4 shrink-0" aria-hidden="true" />
        <h2 class="mr-2 ml-1 truncate font-semibold">{{ heading }}</h2>
        <template v-if="since">
          <span class="mr-2 shrink-0 text-fg-muted">{{ SINCE_REVIEW_NOTE }}</span>
          <button
            type="button"
            :disabled="busy"
            class="mr-2 shrink-0 rounded border border-control-border px-3.5 py-1 hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted"
            @mousedown.prevent
            @click="reviewFromStart"
          >
            {{ REVIEW_FROM_START_LABEL }}
          </button>
        </template>
        <span v-if="note !== null" class="mr-2 shrink-0 text-fg-muted">{{ note }}</span>
        <button
          type="button"
          :title="PREVIOUS"
          :aria-label="PREVIOUS"
          :disabled="!isColumns"
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
          :disabled="!isColumns"
          class="rounded p-1.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
          @mousedown.prevent
          @click="moveToChange('down')"
        >
          <ArrowDown class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          :title="COLLAPSE_LABEL"
          :aria-label="COLLAPSE_LABEL"
          :aria-pressed="collapsing"
          :disabled="!isColumns"
          class="rounded p-1.5 hover:bg-hover disabled:pointer-events-none disabled:text-fg-muted disabled:hover:bg-transparent aria-pressed:bg-row-selected aria-pressed:hover:brightness-110"
          @mousedown.prevent
          @click="toggleCollapsing"
        >
          <ChevronsDownUp class="size-4" aria-hidden="true" />
        </button>
        <span class="ml-3 shrink-0 text-fg-muted" role="status">{{ count }}</span>
        <RangeSendButton class="ml-auto" />
        <MergeRequestsButton />
        <SettingsButton />
      </header>
    </template>
    <template #default="{ stripLayer }">
      <h3
        v-if="since"
        class="col-start-1 row-start-1 truncate border-b border-separator px-3 py-1.5 text-fg-muted"
      >
        {{ SINCE_REVIEW_HEADING }}
      </h3>
      <RangeColumnHeading v-else :column="columns.left" class="col-start-1 row-start-1" />
      <div class="col-start-2 row-start-1 border-b border-separator" />
      <RangeColumnHeading :column="columns.right" class="col-start-3 row-start-1" />
      <template v-if="isColumns">
        <div ref="left" class="col-start-1 row-start-2 min-h-0 min-w-0" />
        <div class="col-start-2 row-start-2" :class="stripLayer">
          <svg ref="strip" aria-hidden="true" class="block h-full w-full" />
        </div>
        <div ref="right" class="col-start-3 row-start-2 min-h-0 min-w-0" />
        <RangeThreadLayer v-if="!since" :file="file" :hosts="threadHosts" />
      </template>
      <p
        v-else-if="sentence !== null"
        ref="sentenceBox"
        tabindex="-1"
        class="col-span-3 col-start-1 row-start-2 px-3 py-4 outline-none"
      >
        {{ sentence }}
      </p>
    </template>
  </PaneFrame>
</template>
