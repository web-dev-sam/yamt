<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { computed, onUnmounted, useTemplateRef, watch } from "vue";

import { pressesKey, type FileMergeData, type Side } from "../ipc";
import { DELETE, DELETED_LINE, DELETED_SENTENCE, KEEP, notTextLine } from "./choiceText";
import type { FileWork } from "./closeGuard";
import { deletedSideView, keptToApply } from "./deletedSide";
import MergeToolbar from "./MergeToolbar.vue";
import SettingsButton from "./SettingsButton.vue";
import { sideHeader } from "./sideHeaders";
import { SIDES } from "./sides";
import { useAppStore } from "./store";
import { useMergeController } from "./useMergeController";
import { isEditable } from "./views";

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
const {
  track,
  untrack,
  finish,
  save,
  reset,
  takeSide,
  taken,
  sideNames,
  question,
  preferences,
  settings,
  collapsing,
} = useAppStore();
const handle = useMergeController(
  () => props.data,
  { left, center, right, strips: [leftStrip, rightStrip] },
  { readOnly: () => !isEditable(props.data), preferences, collapsed: collapsing, servers: null },
);
const { summary, unsaved, applyAllNonConflicting, moveToChange, undo, redo, historyKey, snapshot } =
  handle;
const work: FileWork = { unsaved: () => unsaved.value };
if (props.data.deleted === null) {
  track(props.data.path, work);
}
useEventListener(window, "keydown", historyKeyInShownFile);
useEventListener(window, "keydown", saveKeyInShownFile);

const deletedView = computed(() => {
  const { deleted, path, middle } = props.data;
  return deleted === null
    ? null
    : deletedSideView(deleted, taken.value.get(path) ?? null, middle.kind);
});
const columns = computed(() =>
  SIDES.map((side): Column => ({
    side,
    ...sideHeader(side, sideNames.value),
    gridColumn: GRID_COLUMN[side],
    keep: deletedView.value?.keepIn === side,
    deleted: side === props.data.deleted,
    delete: deletedView.value?.deleteIn === side,
  })),
);
const centerLine = computed(() => {
  const { middle } = props.data;
  if (deletedView.value?.middle === "deleted") {
    return DELETED_LINE;
  }
  return middle.kind === "DiskNotText" ? notTextLine(middle.found) : null;
});
const editable = computed(() => isEditable(props.data));
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
  const result = snapshot();
  if (result !== null && summary.value !== null) {
    void finish({
      path: props.data.path,
      snapshot: result,
      summary: summary.value,
      diskVersion: props.data.diskVersion,
    });
  }
}

function historyKeyInShownFile(event: KeyboardEvent): void {
  if (props.shown && question.value === null) {
    historyKey(event);
  }
}

function saveKeyInShownFile(event: KeyboardEvent): void {
  if (
    !props.shown ||
    question.value !== null ||
    !editable.value ||
    event.defaultPrevented ||
    !pressesKey(event, settings.value.keys.bindings.save, navigator.platform)
  ) {
    return;
  }
  event.preventDefault();
  void save({ path: props.data.path, diskVersion: props.data.diskVersion, handle });
}
</script>

<template>
  <div
    class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col gap-island"
    :class="{ 'invisible [content-visibility:hidden]': !shown }"
  >
    <MergeToolbar
      v-if="editable"
      :summary="summary"
      @move="moveToChange"
      @apply-left="applyAllNonConflicting('local')"
      @apply-right="applyAllNonConflicting('remote')"
      @undo="undo"
      @redo="redo"
      @finish="markResolved"
    />
    <header v-else class="flex h-10 shrink-0 items-center justify-end px-2">
      <SettingsButton />
    </header>
    <!-- Rounded without clipping: overflow hidden around the scrolling panes was slower in WebKitGTK (plan §2 #51); the 4 px inset keeps the pane corners inside the arc. -->
    <section
      class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] rounded-island bg-panel px-1 pb-1"
    >
      <div
        v-for="column in columns"
        :key="column.side"
        class="row-start-1 flex min-w-0 items-center gap-2 border-b border-separator px-3 py-1.5"
        :class="column.gridColumn"
      >
        <h2 class="min-w-0 truncate text-fg-muted" :title="column.tooltip">{{ column.text }}</h2>
        <button
          v-if="column.keep"
          type="button"
          class="shrink-0 rounded border border-control-border px-3.5 py-0.5 hover:bg-hover"
          @click="takeSide(data.path, column.side, data.diskVersion)"
        >
          {{ KEEP }}
        </button>
      </div>
      <div class="col-start-2 row-start-1 border-b border-separator" />
      <div
        class="col-start-3 row-start-1 flex min-w-0 items-center gap-2 border-b border-separator px-3 py-1.5"
      >
        <h2 class="text-fg-muted">Result</h2>
        <button
          type="button"
          :disabled="!resettable"
          class="rounded border border-control-border px-3.5 py-0.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
          @click="reset(data.path, data.diskVersion)"
        >
          Reset
        </button>
        <span
          v-if="unsaved"
          role="img"
          title="Not saved"
          aria-label="Not saved"
          class="ml-auto size-2 shrink-0 rounded-full bg-fg"
        />
      </div>
      <div class="col-start-4 row-start-1 border-b border-separator" />

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
        :class="{ invisible: centerLine !== null }"
      />
      <p v-if="centerLine !== null" class="col-start-3 row-start-2 p-3">{{ centerLine }}</p>
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
            @click="takeSide(data.path, column.side, data.diskVersion)"
          >
            {{ DELETE }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
