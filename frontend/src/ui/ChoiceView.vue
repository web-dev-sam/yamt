<script setup lang="ts">
import { computed } from "vue";

import type { FileSides, Side } from "../ipc";
import { resultLine, sideButton, sideSentence, sideTooltip } from "./choiceText";
import SettingsButton from "./SettingsButton.vue";
import { sideHeader } from "./sideHeaders";
import { SIDES } from "./sides";
import { useAppStore } from "./store";

type Column = {
  readonly side: Side;
  readonly header: string;
  readonly headerTooltip: string;
  readonly gridColumn: string;
  readonly sentence: string;
  readonly tooltip: string | undefined;
  readonly button: string;
};

const props = defineProps<{ sides: FileSides; shown: boolean }>();

const GRID_COLUMN: Readonly<Record<Side, string>> = { local: "col-start-1", remote: "col-start-3" };

const { takeSide, reset, remoteName, taken } = useAppStore();

const sideTaken = computed(() => taken.value.get(props.sides.path) ?? null);
const columns = computed(() =>
  SIDES.map((side): Column => {
    const header = sideHeader(side, remoteName.value);
    return {
      side,
      header: header.text,
      headerTooltip: header.tooltip,
      gridColumn: GRID_COLUMN[side],
      sentence: sideSentence(props.sides[side]),
      tooltip: sideTooltip(props.sides[side]),
      button: sideButton(props.sides, side),
    };
  }),
);
const result = computed(() => resultLine(props.sides, sideTaken.value));
</script>

<template>
  <div
    class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col gap-island"
    :class="{ invisible: !shown }"
  >
    <header class="flex h-10 shrink-0 items-center justify-end px-2">
      <SettingsButton />
    </header>
    <section
      class="grid min-h-0 min-w-0 flex-1 grid-cols-3 grid-rows-[auto_minmax(0,1fr)] gap-x-px overflow-hidden rounded-island bg-separator"
    >
      <template v-for="column in columns" :key="column.side">
        <div
          class="row-start-1 flex min-w-0 items-center border-b border-separator bg-panel px-3 py-1.5"
          :class="column.gridColumn"
        >
          <h2 class="min-w-0 truncate text-fg-muted" :title="column.headerTooltip">
            {{ column.header }}
          </h2>
        </div>
        <div
          class="row-start-2 flex min-w-0 flex-col items-start gap-3 bg-panel p-3"
          :class="column.gridColumn"
        >
          <p class="wrap-break-word" :title="column.tooltip">{{ column.sentence }}</p>
          <button
            v-if="sideTaken === null"
            type="button"
            class="rounded border border-control-border px-3.5 py-1 hover:bg-hover"
            @click="takeSide(sides.path, column.side, sides.diskVersion)"
          >
            {{ column.button }}
          </button>
        </div>
      </template>
      <div
        class="col-start-2 row-start-1 flex min-w-0 items-center gap-2 border-b border-separator bg-panel px-3 py-1.5"
      >
        <h2 class="text-fg-muted">Result</h2>
        <button
          type="button"
          :disabled="sideTaken === null"
          class="rounded border border-control-border px-3.5 py-0.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
          @click="reset(sides.path, sides.diskVersion)"
        >
          Reset
        </button>
      </div>
      <p class="col-start-2 row-start-2 bg-panel p-3 wrap-break-word" role="status">
        {{ result }}
      </p>
    </section>
  </div>
</template>
