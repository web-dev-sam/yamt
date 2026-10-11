<script setup lang="ts">
import { computed, onUnmounted, useTemplateRef, watch } from "vue";

import type { FileMergeData, Side } from "../ipc";
import { DELETE, DELETED_LINE, DELETED_SENTENCE, KEEP } from "./choiceText";
import type { FileWork } from "./closeGuard";
import { deletedSideView, keptToApply } from "./deletedSide";
import MergeToolbar from "./MergeToolbar.vue";
import { sideHeader } from "./sideHeaders";
import { SIDES } from "./sides";
import { useAppStore } from "./store";
import { useMergeController } from "./useMergeController";

type Column = {
  readonly side: Side;
  readonly text: string;
  readonly tooltip: string;
  readonly gridColumn: string;
  readonly keep: boolean;
  readonly deleted: boolean;
  readonly delete: boolean;
};

const props = defineProps<{ data: FileMergeData; shown: boolean }>();

const GRID_COLUMN: Readonly<Record<Side, string>> = { local: "col-start-1", remote: "col-start-5" };

const left = useTemplateRef<HTMLDivElement>("left");
const center = useTemplateRef<HTMLDivElement>("center");
const right = useTemplateRef<HTMLDivElement>("right");
const leftStrip = useTemplateRef<SVGSVGElement>("leftStrip");
const rightStrip = useTemplateRef<SVGSVGElement>("rightStrip");
const { summary, applyAllNonConflicting, undo, redo, resultText, unsaved, markSaved } =
  useMergeController(() => props.data, { left, center, right, strips: [leftStrip, rightStrip] });
const { track, untrack, finish, reset, takeSide, taken, remoteName } = useAppStore();
const work: FileWork = { unsaved, markSaved };
if (props.data.deleted === null) {
  track(props.data.path, work);
}

const deletedView = computed(() => {
  const { deleted, path } = props.data;
  return deleted === null ? null : deletedSideView(deleted, taken.value.get(path) ?? null);
});
const columns = computed(() =>
  SIDES.map((side): Column => ({
    side,
    ...sideHeader(side, remoteName.value),
    gridColumn: GRID_COLUMN[side],
    keep: deletedView.value?.keepIn === side,
    deleted: side === props.data.deleted,
    delete: deletedView.value?.deleteIn === side,
  })),
);
const deletedShown = computed(() => deletedView.value?.middle === "deleted");
const resettable = computed(() => deletedView.value?.resettable ?? summary.value !== null);
const keptSideToApply = computed(() =>
  deletedView.value === null ? null : keptToApply(deletedView.value, summary.value),
);

watch(
  keptSideToApply,
  (side) => {
    if (side !== null) {
      applyAllNonConflicting(side);
    }
  },
  { immediate: true },
);

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
  <div
    class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col"
    :class="{ 'invisible [content-visibility:hidden]': !shown }"
  >
    <MergeToolbar
      v-if="data.deleted === null"
      :summary="summary"
      @apply-left="applyAllNonConflicting('local')"
      @apply-right="applyAllNonConflicting('remote')"
      @undo="undo"
      @redo="redo"
      @finish="markResolved"
    />
    <header v-else class="h-10 shrink-0 border-b border-separator bg-window" />
    <section
      class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-editor"
    >
      <div
        v-for="column in columns"
        :key="column.side"
        class="row-start-1 flex min-w-0 items-center gap-2 border-b border-separator bg-window px-3 py-1.5"
        :class="column.gridColumn"
      >
        <h2 class="min-w-0 truncate text-fg-muted" :title="column.tooltip">{{ column.text }}</h2>
        <button
          v-if="column.keep"
          type="button"
          class="shrink-0 rounded border border-control-border px-3.5 py-0.5 hover:bg-hover"
          @click="takeSide(data.path, column.side)"
        >
          {{ KEEP }}
        </button>
      </div>
      <div class="col-start-2 row-start-1 border-b border-separator bg-window" />
      <div
        class="col-start-3 row-start-1 flex min-w-0 items-center gap-2 border-b border-separator bg-window px-3 py-1.5"
      >
        <h2 class="text-fg-muted">Result</h2>
        <button
          type="button"
          :disabled="!resettable"
          class="rounded border border-control-border px-3.5 py-0.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
          @click="reset(data.path)"
        >
          Reset
        </button>
      </div>
      <div class="col-start-4 row-start-1 border-b border-separator bg-window" />

      <div
        ref="left"
        class="col-start-1 row-start-2 min-h-0 min-w-0"
        :class="{ invisible: data.deleted === 'local' }"
      />
      <!-- Each strip and its border sit on their own layer: repainting them inside the window's layer on every scroll frame was slow in WebKitGTK (plan §2 #51). -->
      <div class="col-start-2 row-start-2 min-h-0 border-x border-separator will-change-transform">
        <svg ref="leftStrip" aria-hidden="true" class="block h-full w-full" />
      </div>
      <div
        ref="center"
        class="col-start-3 row-start-2 min-h-0 min-w-0"
        :class="{ invisible: deletedShown }"
      />
      <p v-if="deletedShown" class="col-start-3 row-start-2 p-3">{{ DELETED_LINE }}</p>
      <div class="col-start-4 row-start-2 min-h-0 border-x border-separator will-change-transform">
        <svg ref="rightStrip" aria-hidden="true" class="block h-full w-full" />
      </div>
      <div
        ref="right"
        class="col-start-5 row-start-2 min-h-0 min-w-0"
        :class="{ invisible: data.deleted === 'remote' }"
      />
      <template v-for="column in columns" :key="column.side">
        <div
          v-if="column.deleted"
          class="row-start-2 flex min-w-0 flex-col items-start gap-3 p-3"
          :class="column.gridColumn"
        >
          <p>{{ DELETED_SENTENCE }}</p>
          <button
            v-if="column.delete"
            type="button"
            class="rounded border border-control-border px-3.5 py-1 hover:bg-hover"
            @click="takeSide(data.path, column.side)"
          >
            {{ DELETE }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
