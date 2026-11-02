<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { computed, nextTick, shallowRef, useTemplateRef } from "vue";
import Calendar from "~icons/lucide/calendar";

import {
  daysLeft,
  daysLeftText,
  dueDateText,
  localDay,
  typedDay,
  type CalendarDay,
} from "../mergeRequests";
import type { Point } from "./menuPosition";
import MergeRequestCalendar from "./MergeRequestCalendar.vue";
import {
  CLEAR_DUE_DATE,
  DUE_DATE_DIALOG,
  DUE_DATE_PLACEHOLDER,
  dueDateLabel,
  PICK_TODAY,
  SET_DUE_DATE,
} from "./mergeRequestsText";
import { vTooltip } from "./tooltip";
import { useScrollOutside } from "./useHoverBox";
import { belowLeft, useMenuPlacement } from "./useMenuPlacement";

const props = defineProps<{ due: CalendarDay | null; now: number }>();
const emit = defineEmits<{ set: [day: CalendarDay | null] }>();

const opener = useTemplateRef<HTMLButtonElement>("opener");
const box = useTemplateRef<HTMLDivElement>("box");
const open = shallowRef(false);
const refused = shallowRef(false);
const draft = shallowRef("");
const at = shallowRef<Point>({ x: 0, y: 0 });
const placement = useMenuPlacement(box, at);
onClickOutside(
  box,
  () => {
    open.value = false;
  },
  { ignore: [opener] },
);
useScrollOutside(
  () => box.value,
  () => {
    open.value = false;
  },
);

const today = computed(() => localDay(props.now));
const shown = computed(() => {
  if (props.due === null) {
    return null;
  }
  const date = dueDateText(props.due);
  const left = daysLeftText(daysLeft(props.due, props.now));
  return { date, left, label: dueDateLabel(date, left.text) };
});
const label = computed(() => shown.value?.label ?? SET_DUE_DATE);

function openerClicked(): void {
  if (open.value || opener.value === null) {
    open.value = false;
    return;
  }
  at.value = belowLeft(opener.value);
  refused.value = false;
  draft.value = shown.value?.date ?? "";
  open.value = true;
}

async function closeToOpener(): Promise<void> {
  open.value = false;
  await nextTick();
  if (document.activeElement === null || document.activeElement === document.body) {
    opener.value?.focus();
  }
}

function save(day: CalendarDay | null): void {
  emit("set", day);
  void closeToOpener();
}

function typedEntered(): void {
  const day = typedDay(draft.value);
  if (day === null) {
    refused.value = true;
    return;
  }
  save(day);
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
      aria-haspopup="dialog"
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
      role="dialog"
      :aria-label="DUE_DATE_DIALOG"
      class="fixed z-10 flex flex-col gap-3 rounded-md border border-control-border bg-panel-inline p-3 text-fg shadow-lg"
      :style="placement"
    >
      <input
        v-model="draft"
        type="text"
        :placeholder="DUE_DATE_PLACEHOLDER"
        :aria-label="SET_DUE_DATE"
        :aria-invalid="refused"
        class="rounded-md border bg-panel px-2 py-1 text-sm outline-none"
        :class="refused ? 'border-problem-error' : 'border-control-border focus:border-primary'"
        @input="refused = false"
        @keydown.enter.prevent="typedEntered"
      />
      <MergeRequestCalendar :selected="due" :today="today" @pick="save" />
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-md border border-control-border px-2.5 py-1 text-sm hover:bg-hover"
          @click="save(today)"
        >
          {{ PICK_TODAY }}
        </button>
        <button
          v-if="shown !== null"
          type="button"
          class="flex-1 rounded-md border border-control-border px-2.5 py-1 text-sm hover:bg-hover"
          @click="save(null)"
        >
          {{ CLEAR_DUE_DATE }}
        </button>
      </div>
    </div>
  </span>
</template>
