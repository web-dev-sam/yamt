<script setup lang="ts">
import { computed, onUnmounted, useTemplateRef, watch } from "vue";

import type { FileMergeData, Side } from "../ipc";
import { DELETE, DELETED_LINE, DELETED_SENTENCE, KEEP } from "./choiceText";
import MergeToolbar from "./MergeToolbar.vue";
import { sideHeader } from "./sideHeaders";
import { useAppStore, type FileWork } from "./store";
import { useMergeController } from "./useMergeController";

type Column = {
  readonly side: Side;
  readonly text: string;
  readonly tooltip: string;
  readonly column: string;
  readonly keep: boolean;
  readonly deleted: boolean;
};

const props = defineProps<{ data: FileMergeData; shown: boolean }>();

const SIDES: readonly Side[] = ["local", "remote"];
const GRID_COLUMN: Readonly<Record<Side, string>> = { local: "col-start-1", remote: "col-start-5" };

const left = useTemplateRef<HTMLDivElement>("left");
const center = useTemplateRef<HTMLDivElement>("center");
const right = useTemplateRef<HTMLDivElement>("right");
const leftStrip = useTemplateRef<SVGSVGElement>("leftStrip");
const rightStrip = useTemplateRef<SVGSVGElement>("rightStrip");
const { summary, applyAllNonConflicting, undo, redo, resultText, unsaved, markSaved } =
  useMergeController(() => props.data, { left, center, right, strips: [leftStrip, rightStrip] });
const { track, untrack, finish, reset, takeSide, taken, remote } = useAppStore();
const work: FileWork = { unsaved, markSaved };
if (props.data.deleted === null) {
  track(props.data.path, work);
}

const sideTaken = computed(() => taken.value.get(props.data.path) ?? null);
const kept = computed(() => {
  const { deleted } = props.data;
  return deleted === null ? null : (SIDES.find((side) => side !== deleted) ?? null);
});
const deletedTaken = computed(
  () => sideTaken.value !== null && sideTaken.value === props.data.deleted,
);
const columns = computed(() =>
  SIDES.map((side): Column => ({
    side,
    ...sideHeader(side, remote.value),
    column: GRID_COLUMN[side],
    keep: side === kept.value && sideTaken.value === null,
    deleted: side === props.data.deleted,
  })),
);
const keptShown = computed(
  () => kept.value !== null && sideTaken.value === kept.value && summary.value !== null,
);
const resettable = computed(() =>
  props.data.deleted === null ? summary.value !== null : sideTaken.value !== null,
);

watch(
  keptShown,
  (shownNow) => {
    if (shownNow && kept.value !== null) {
      applyAllNonConflicting(kept.value);
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
  <div class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col" :class="{ invisible: !shown }">
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
        :class="column.column"
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
      <svg
        ref="leftStrip"
        aria-hidden="true"
        class="col-start-2 row-start-2 h-full w-full border-x border-separator"
      />
      <div
        ref="center"
        class="col-start-3 row-start-2 min-h-0 min-w-0"
        :class="{ invisible: deletedTaken }"
      />
      <p v-if="deletedTaken" class="col-start-3 row-start-2 p-3">{{ DELETED_LINE }}</p>
      <svg
        ref="rightStrip"
        aria-hidden="true"
        class="col-start-4 row-start-2 h-full w-full border-x border-separator"
      />
      <div
        ref="right"
        class="col-start-5 row-start-2 min-h-0 min-w-0"
        :class="{ invisible: data.deleted === 'remote' }"
      />
      <template v-for="column in columns" :key="column.side">
        <div
          v-if="column.deleted"
          class="row-start-2 flex min-w-0 flex-col items-start gap-3 p-3"
          :class="column.column"
        >
          <p>{{ DELETED_SENTENCE }}</p>
          <button
            v-if="sideTaken === null"
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
