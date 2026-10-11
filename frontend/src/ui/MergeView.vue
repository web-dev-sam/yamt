<script setup lang="ts">
import { onUnmounted, useTemplateRef } from "vue";

import type { FileMergeData } from "../ipc";
import MergeToolbar from "./MergeToolbar.vue";
import { SIDE_HEADERS } from "./sideHeaders";
import { useAppStore, type FileWork } from "./store";
import { useMergeController } from "./useMergeController";

const props = defineProps<{ data: FileMergeData; shown: boolean }>();

const left = useTemplateRef<HTMLDivElement>("left");
const center = useTemplateRef<HTMLDivElement>("center");
const right = useTemplateRef<HTMLDivElement>("right");
const leftStrip = useTemplateRef<SVGSVGElement>("leftStrip");
const rightStrip = useTemplateRef<SVGSVGElement>("rightStrip");
const { summary, applyAllNonConflicting, undo, redo, resultText, unsaved, markSaved } =
  useMergeController(() => props.data, { left, center, right, strips: [leftStrip, rightStrip] });
const { track, untrack, finish, reset } = useAppStore();
const work: FileWork = { unsaved, markSaved };
track(props.data.path, work);

onUnmounted(() => {
  untrack(props.data.path, work);
});

function markResolved(): void {
  const text = resultText();
  if (text !== null && summary.value !== null) {
    void finish({ path: props.data.path, text, summary: summary.value });
  }
}
</script>

<template>
  <div class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col" :class="{ invisible: !shown }">
    <MergeToolbar
      :summary="summary"
      @apply-left="applyAllNonConflicting('local')"
      @apply-right="applyAllNonConflicting('remote')"
      @undo="undo"
      @redo="redo"
      @reset="reset(data.path)"
      @finish="markResolved"
    />
    <section
      class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-editor"
    >
      <h2 class="border-b border-separator bg-window px-3 py-1.5 text-fg-muted">
        {{ SIDE_HEADERS.local }}
      </h2>
      <div class="border-b border-separator bg-window" />
      <h2 class="border-b border-separator bg-window px-3 py-1.5 text-fg-muted">Result</h2>
      <div class="border-b border-separator bg-window" />
      <h2 class="border-b border-separator bg-window px-3 py-1.5 text-fg-muted">
        {{ SIDE_HEADERS.remote }}
      </h2>

      <div ref="left" class="min-h-0 min-w-0" />
      <svg ref="leftStrip" aria-hidden="true" class="h-full w-full border-x border-separator" />
      <div ref="center" class="min-h-0 min-w-0" />
      <svg ref="rightStrip" aria-hidden="true" class="h-full w-full border-x border-separator" />
      <div ref="right" class="min-h-0 min-w-0" />
    </section>
  </div>
</template>
