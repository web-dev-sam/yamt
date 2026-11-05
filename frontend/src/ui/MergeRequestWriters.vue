<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { computed, useTemplateRef } from "vue";

import type { Person } from "../ipc";
import { foldedWriters, moreText, noteAuthorName } from "../mergeRequests";
import { PICTURE_PX, pictureBox } from "./mergeRequestPeopleLook";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import { foldedWritersText } from "./mergeRequestsText";
import { vTooltip } from "./tooltip";

const props = defineProps<{ writers: readonly (Person | null)[] }>();

const GAP_PX = 4;
const ROW = { gap: `${GAP_PX}px` };
const SLOT = pictureBox("box");

const row = useTemplateRef<HTMLDivElement>("row");
const { width } = useElementSize(row, { width: Number.POSITIVE_INFINITY, height: 0 });

const fold = computed(() =>
  foldedWriters(props.writers, Math.floor((width.value + GAP_PX) / (PICTURE_PX.box + GAP_PX))),
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
    class="flex min-w-0 flex-1 items-center overflow-hidden"
    :style="ROW"
  >
    <span
      v-if="more !== null"
      v-tooltip="more.tip"
      class="flex shrink-0 items-center justify-center overflow-hidden text-[0.625rem] whitespace-nowrap text-fg-muted"
      :style="SLOT"
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
