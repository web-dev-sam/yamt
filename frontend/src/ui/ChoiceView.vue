<script setup lang="ts">
import { computed, useTemplateRef } from "vue";

import type { FileSides, Side } from "../ipc";
import { resultLine, sideButton, sideSentence, sideTooltip } from "./choiceText";
import OperationButtons from "./OperationButtons.vue";
import PaneDivider from "./PaneDivider.vue";
import { paneColumns, type PaneWidths } from "./paneSplit";
import ServerStatus from "./ServerStatus.vue";
import SettingsButton from "./SettingsButton.vue";
import { RESULT_HEADER, sideHeader } from "./sideHeaders";
import { SIDES } from "./sides";
import { useAppStore } from "./store";
import { usePaneDividers } from "./usePaneDividers";

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

const GRID_COLUMN: Readonly<Record<Side, string>> = { local: "col-start-1", remote: "col-start-5" };

const section = useTemplateRef<HTMLElement>("section");
const localGutter = useTemplateRef<HTMLDivElement>("localGutter");
const remoteGutter = useTemplateRef<HTMLDivElement>("remoteGutter");
const { takeSide, reset, sideNames, taken, paneSplit, setPaneSplit, resetPaneSplit } =
  useAppStore();
const dividers = usePaneDividers(paneWidths, { setPaneSplit, resetPaneSplit });

const gridTemplateColumns = computed(() => paneColumns(paneSplit.value, "gap"));
const sideTaken = computed(() => taken.value.get(props.sides.path) ?? null);
const columns = computed(() =>
  SIDES.map((side): Column => {
    const header = sideHeader(side, sideNames.value);
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

function paneWidths(): PaneWidths | null {
  if (section.value === null || localGutter.value === null || remoteGutter.value === null) {
    return null;
  }
  const whole = section.value.getBoundingClientRect();
  const localEdge = localGutter.value.getBoundingClientRect();
  const remoteEdge = remoteGutter.value.getBoundingClientRect();
  return {
    local: localEdge.left - whole.left,
    center: remoteEdge.left - localEdge.right,
    remote: whole.right - remoteEdge.right,
  };
}
</script>

<template>
  <div
    class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col gap-island"
    :class="{ invisible: !shown }"
  >
    <header class="flex h-10 shrink-0 items-center justify-end px-2">
      <OperationButtons :abort="true" />
      <ServerStatus class="ml-auto" :path="null" :problems="null" />
      <SettingsButton />
    </header>
    <section
      ref="section"
      class="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden island bg-separator"
      :style="{ gridTemplateColumns }"
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
        class="col-start-3 row-start-1 flex min-w-0 items-center gap-2 border-b border-separator bg-panel px-3 py-1.5"
      >
        <h2 class="text-fg-muted">{{ RESULT_HEADER }}</h2>
        <button
          type="button"
          :disabled="sideTaken === null"
          class="rounded border border-control-border px-3.5 py-0.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
          @click="reset(sides.path, sides.diskVersion)"
        >
          Reset
        </button>
      </div>
      <p class="col-start-3 row-start-2 bg-panel p-3 wrap-break-word" role="status">
        {{ result }}
      </p>
      <div ref="localGutter" class="relative col-start-2 row-span-2 row-start-1">
        <PaneDivider
          side="local"
          :handle="dividers.local"
          class="absolute -inset-x-[2px] inset-y-0 z-10"
        />
      </div>
      <div ref="remoteGutter" class="relative col-start-4 row-span-2 row-start-1">
        <PaneDivider
          side="remote"
          :handle="dividers.remote"
          class="absolute -inset-x-[2px] inset-y-0 z-10"
        />
      </div>
    </section>
  </div>
</template>
