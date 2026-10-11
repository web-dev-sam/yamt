<script setup lang="ts">
import { computed } from "vue";

import type { Side } from "../ipc";
import { resolvedLine, sideButton, sideSentence, sideTooltip } from "./choiceText";
import { SIDE_HEADERS } from "./sideHeaders";
import { useAppStore, type Choice } from "./store";

type Column = {
  readonly side: Side;
  readonly header: string;
  readonly sentence: string;
  readonly tooltip: string | undefined;
  readonly button: string;
};

const props = defineProps<{ choice: Choice; shown: boolean }>();

const SIDES: readonly Side[] = ["local", "remote"];

const { takeSide, reset } = useAppStore();

const columns = computed(() =>
  SIDES.map((side): Column => ({
    side,
    header: SIDE_HEADERS[side],
    sentence: sideSentence(props.choice.sides[side]),
    tooltip: sideTooltip(props.choice.sides[side]),
    button: sideButton(props.choice.sides, side),
  })),
);
const resolved = computed(() =>
  props.choice.taken === null ? "" : resolvedLine(props.choice.sides, props.choice.taken),
);
</script>

<template>
  <div class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col" :class="{ invisible: !shown }">
    <header class="flex h-10 shrink-0 items-center gap-1 border-b border-separator bg-window px-2">
      <span class="ml-3 text-fg-muted" role="status">{{ resolved }}</span>
      <button
        type="button"
        :disabled="choice.taken === null"
        class="ml-auto rounded border border-control-border px-3.5 py-1 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
        @click="reset(choice.sides.path)"
      >
        Reset file
      </button>
    </header>
    <section
      class="grid min-h-0 min-w-0 flex-1 grid-flow-col grid-cols-2 grid-rows-[auto_minmax(0,1fr)] gap-x-px bg-separator"
    >
      <template v-for="column in columns" :key="column.side">
        <h2 class="border-b border-separator bg-window px-3 py-1.5 text-fg-muted">
          {{ column.header }}
        </h2>
        <div class="flex min-w-0 flex-col items-start gap-3 bg-editor p-3">
          <p class="wrap-break-word" :title="column.tooltip">{{ column.sentence }}</p>
          <button
            v-if="choice.taken === null"
            type="button"
            class="rounded border border-control-border px-3.5 py-1 hover:bg-hover"
            @click="takeSide(choice.sides.path, column.side)"
          >
            {{ column.button }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
