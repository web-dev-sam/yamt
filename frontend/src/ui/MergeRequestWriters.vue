<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { computed, useTemplateRef } from "vue";

import type { Person } from "../ipc";
import { foldedWriters, moreText, noteAuthorName } from "../mergeRequests";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import { foldedWritersText } from "./mergeRequestsText";
import { vTooltip } from "./tooltip";

const props = defineProps<{ writers: readonly (Person | null)[] }>();

const PICTURE_PX = 20;
const GAP_PX = 4;

const row = useTemplateRef<HTMLDivElement>("row");
const { width } = useElementSize(row, { width: Number.POSITIVE_INFINITY, height: 0 });

const fold = computed(() =>
  foldedWriters(props.writers, Math.floor((width.value + GAP_PX) / (PICTURE_PX + GAP_PX))),
);
const more = computed(() => {
  const { folded } = fold.value;
  return folded.length === 0
    ? null
    : { text: moreText(folded.length), tip: foldedWritersText(folded.map(noteAuthorName)) };
});
</script>

<template>
  <div
    v-if="writers.length > 0"
    ref="row"
    class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden"
  >
    <span
      v-if="more !== null"
      v-tooltip="more.tip"
      class="flex h-5 min-w-5 shrink-0 items-center justify-center text-xs text-fg-muted"
      >{{ more.text }}</span
    >
    <span
      v-for="(writer, index) in fold.shown"
      :key="index"
      v-tooltip="noteAuthorName(writer)"
      role="img"
      :aria-label="noteAuthorName(writer)"
      class="flex shrink-0"
    >
      <MergeRequestPicture :person="writer" size="box" aria-hidden="true" />
    </span>
  </div>
</template>
