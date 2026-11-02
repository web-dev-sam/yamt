<script setup lang="ts">
import { computed, useTemplateRef } from "vue";

import type { Label } from "../ipc";
import { labelsShown, moreText } from "../mergeRequests";
import { vTooltip } from "./tooltip";
import { useHoverBox } from "./useHoverBox";

type Chip = {
  readonly title: string;
  readonly tone: string;
  readonly style: { readonly backgroundColor: string; readonly color: string } | null;
};

const props = defineProps<{ labels: readonly Label[] }>();

const PLAIN_TONE = "bg-hover text-fg";

const area = useTemplateRef<HTMLSpanElement>("area");
const opener = useTemplateRef<HTMLButtonElement>("opener");
const box = useTemplateRef<HTMLDivElement>("box");
const { open, placement, on } = useHoverBox({
  area: () => area.value,
  opener: () => opener.value,
  box,
});

const chips = computed(() => {
  const { first, rest } = labelsShown(props.labels);
  return { first: first === null ? null : chip(first), rest: rest.map(chip) };
});

function chip({ title, colors }: Label): Chip {
  return colors === null
    ? { title, tone: PLAIN_TONE, style: null }
    : { title, tone: "", style: { backgroundColor: colors.background, color: colors.text } };
}
</script>

<template>
  <span v-if="chips.first !== null" class="flex shrink-0 items-center gap-1 text-xs">
    <span
      v-tooltip="chips.first.title"
      class="max-w-40 truncate rounded px-1.5"
      :class="chips.first.tone"
      :style="chips.first.style"
      >{{ chips.first.title }}</span
    >
    <span
      v-if="chips.rest.length > 0"
      ref="area"
      data-row-control
      class="flex cursor-default"
      @click.stop
      @pointerenter="on.pointerenter"
      @pointerleave="on.pointerleave"
      @focusin="on.focusin"
      @focusout="on.focusout"
      @keydown="on.keydown"
    >
      <button
        ref="opener"
        type="button"
        :aria-expanded="open"
        class="rounded px-1.5"
        :class="PLAIN_TONE"
      >
        {{ moreText(chips.rest.length) }}
      </button>
      <div
        v-if="open"
        ref="box"
        class="fixed z-10 max-h-[60vh] w-max max-w-[30rem] overflow-y-auto rounded-md border border-control-border bg-panel-inline p-1.5 shadow-lg"
        :style="placement"
      >
        <ul class="flex flex-col items-start gap-1">
          <li
            v-for="label in chips.rest"
            :key="label.title"
            v-tooltip="label.title"
            class="max-w-40 truncate rounded px-1.5"
            :class="label.tone"
            :style="label.style"
          >
            {{ label.title }}
          </li>
        </ul>
      </div>
    </span>
  </span>
</template>
