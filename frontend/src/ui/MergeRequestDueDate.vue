<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { computed, nextTick, shallowRef, useTemplateRef } from "vue";
import Calendar from "~icons/lucide/calendar";

import {
  calendarDayFrom,
  calendarDayText,
  daysLeft,
  daysLeftText,
  dueDateText,
  type CalendarDay,
} from "../mergeRequests";
import type { Point } from "./menuPosition";
import { CLEAR_DUE_DATE, dueDateLabel, SET_DUE_DATE } from "./mergeRequestsText";
import { vTooltip } from "./tooltip";
import { belowLeft, useMenuPlacement } from "./useMenuPlacement";

const props = defineProps<{ due: CalendarDay | null; now: number }>();
const emit = defineEmits<{ set: [day: CalendarDay | null] }>();

const opener = useTemplateRef<HTMLButtonElement>("opener");
const box = useTemplateRef<HTMLDivElement>("box");
const field = useTemplateRef<HTMLInputElement>("field");
const open = shallowRef(false);
const at = shallowRef<Point>({ x: 0, y: 0 });
const placement = useMenuPlacement(box, at);
onClickOutside(
  box,
  () => {
    open.value = false;
  },
  { ignore: [opener] },
);

const shown = computed(() => {
  if (props.due === null) {
    return null;
  }
  const date = dueDateText(props.due);
  const left = daysLeftText(daysLeft(props.due, props.now));
  return { date, left, label: dueDateLabel(date, left.text), field: calendarDayText(props.due) };
});
const label = computed(() => shown.value?.label ?? SET_DUE_DATE);

async function openerClicked(): Promise<void> {
  if (open.value || opener.value === null) {
    open.value = false;
    return;
  }
  at.value = belowLeft(opener.value);
  open.value = true;
  await nextTick();
  field.value?.focus();
}

async function closeToOpener(): Promise<void> {
  open.value = false;
  await nextTick();
  if (document.activeElement === null || document.activeElement === document.body) {
    opener.value?.focus();
  }
}

function picked(event: Event): void {
  const day = event.target instanceof HTMLInputElement ? calendarDayFrom(event.target.value) : null;
  if (day !== null) {
    emit("set", day);
    void closeToOpener();
  }
}

function clearClicked(): void {
  emit("set", null);
  void closeToOpener();
}

function keyPressed(event: KeyboardEvent): void {
  if (event.key === "Escape" && open.value) {
    event.preventDefault();
    void closeToOpener();
  }
}
</script>

<template>
  <span data-row-control class="flex cursor-default" @click.stop @keydown="keyPressed">
    <button
      ref="opener"
      v-tooltip="label"
      type="button"
      :aria-label="label"
      :aria-expanded="open"
      class="rounded hover:bg-hover"
      :class="shown === null ? 'p-1.5 text-fg-muted' : 'px-1.5 py-0.5 text-left text-xs leading-4'"
      @click="openerClicked"
    >
      <Calendar v-if="shown === null" class="size-4" aria-hidden="true" />
      <template v-else>
        <span class="block whitespace-nowrap">{{ shown.date }}</span>
        <span
          class="block whitespace-nowrap"
          :class="shown.left.overdue ? 'text-problem-error' : 'text-fg-muted'"
          >{{ shown.left.text }}</span
        >
      </template>
    </button>
    <div
      v-if="open"
      ref="box"
      class="fixed z-10 flex items-center gap-2 rounded-md border border-control-border bg-panel-inline p-1.5 text-fg shadow-lg"
      :style="placement"
    >
      <input
        ref="field"
        type="date"
        :value="shown?.field ?? ''"
        :aria-label="SET_DUE_DATE"
        class="rounded border border-control-border bg-panel px-2 py-1 outline-none focus:border-primary"
        @change="picked"
      />
      <button
        v-if="shown !== null"
        type="button"
        class="rounded border border-control-border px-2.5 py-1 hover:bg-hover"
        @click="clearClicked"
      >
        {{ CLEAR_DUE_DATE }}
      </button>
    </div>
  </span>
</template>
