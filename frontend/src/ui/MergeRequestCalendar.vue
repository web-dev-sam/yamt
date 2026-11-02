<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useId, useTemplateRef } from "vue";
import ChevronLeft from "~icons/lucide/chevron-left";
import ChevronRight from "~icons/lucide/chevron-right";

import {
  MONTHS_PER_YEAR,
  WEEKDAYS,
  addDays,
  addMonths,
  calendarDayText,
  dayName,
  monthCaption,
  monthGrid,
  monthOf,
  sameDay,
  weekdayIndex,
  type CalendarDay,
  type CalendarMonth,
} from "../mergeRequests";
import { NEXT_MONTH, PREVIOUS_MONTH } from "./mergeRequestsText";

type DayCell = {
  readonly key: string;
  readonly day: CalendarDay;
  readonly name: string;
  readonly number: number;
  readonly selected: boolean;
  readonly today: boolean;
  readonly focused: boolean;
  readonly tone: string;
};

const props = defineProps<{ selected: CalendarDay | null; today: CalendarDay }>();
const emit = defineEmits<{ pick: [day: CalendarDay] }>();

const grid = useTemplateRef<HTMLDivElement>("grid");
const captionId = useId();
const focused = shallowRef<CalendarDay>(props.selected ?? props.today);

const shown = computed<CalendarMonth>(() => monthOf(focused.value));
const caption = computed(() => monthCaption(shown.value));
const weeks = computed(() => {
  const cells = monthGrid(shown.value).map(({ day, inMonth }) => dayCell(day, inMonth));
  const rows: (readonly DayCell[])[] = [];
  for (let start = 0; start < cells.length; start += WEEKDAYS.length) {
    rows.push(cells.slice(start, start + WEEKDAYS.length));
  }
  return rows;
});

onMounted(() => {
  focusDay();
});

function dayCell(day: CalendarDay, inMonth: boolean): DayCell {
  const selected = props.selected !== null && sameDay(day, props.selected);
  const today = sameDay(day, props.today);
  return {
    key: calendarDayText(day),
    day,
    name: dayName(day),
    number: day.day,
    selected,
    today,
    focused: sameDay(day, focused.value),
    tone: dayTone({ selected, today, inMonth }),
  };
}

function dayTone(day: { selected: boolean; today: boolean; inMonth: boolean }): string {
  if (day.selected) {
    return "bg-primary font-medium text-on-primary";
  }
  const muted = day.inMonth ? "" : " text-fg-muted";
  return day.today ? `bg-hover font-medium hover:bg-hover${muted}` : `hover:bg-hover${muted}`;
}

function focusDay(): void {
  grid.value?.querySelector<HTMLButtonElement>("[data-focused]")?.focus({ preventScroll: true });
}

async function moveTo(day: CalendarDay): Promise<void> {
  focused.value = day;
  await nextTick();
  focusDay();
}

function turnMonth(months: number): void {
  focused.value = addMonths(focused.value, months);
}

function movedDay(event: KeyboardEvent): CalendarDay | null {
  const day = focused.value;
  const months = event.shiftKey ? MONTHS_PER_YEAR : 1;
  switch (event.key) {
    case "ArrowLeft":
      return addDays(day, -1);
    case "ArrowRight":
      return addDays(day, 1);
    case "ArrowUp":
      return addDays(day, -WEEKDAYS.length);
    case "ArrowDown":
      return addDays(day, WEEKDAYS.length);
    case "Home":
      return addDays(day, -weekdayIndex(day));
    case "End":
      return addDays(day, WEEKDAYS.length - 1 - weekdayIndex(day));
    case "PageUp":
      return addMonths(day, -months);
    case "PageDown":
      return addMonths(day, months);
    default:
      return null;
  }
}

function gridKeyPressed(event: KeyboardEvent): void {
  const day = movedDay(event);
  if (day !== null) {
    event.preventDefault();
    void moveTo(day);
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <button
        type="button"
        :aria-label="PREVIOUS_MONTH"
        class="inline-flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"
        @click="turnMonth(-1)"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
      </button>
      <span :id="captionId" class="text-sm font-medium" aria-live="polite">{{ caption }}</span>
      <button
        type="button"
        :aria-label="NEXT_MONTH"
        class="inline-flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"
        @click="turnMonth(1)"
      >
        <ChevronRight class="size-4" aria-hidden="true" />
      </button>
    </div>
    <div
      ref="grid"
      role="grid"
      :aria-labelledby="captionId"
      class="flex flex-col gap-0.5"
      @keydown="gridKeyPressed"
    >
      <div role="row" class="flex">
        <span
          v-for="weekday in WEEKDAYS"
          :key="weekday"
          role="columnheader"
          class="w-8 text-center text-xs text-fg-muted"
          >{{ weekday }}</span
        >
      </div>
      <div v-for="week in weeks" :key="week[0]?.key" role="row" class="flex">
        <span
          v-for="cell in week"
          :key="cell.key"
          role="gridcell"
          :aria-selected="cell.selected"
          class="flex"
        >
          <button
            type="button"
            :tabindex="cell.focused ? 0 : -1"
            :data-focused="cell.focused || undefined"
            :aria-label="cell.name"
            :aria-current="cell.today ? 'date' : undefined"
            class="size-8 rounded-md text-sm"
            :class="cell.tone"
            @click="emit('pick', cell.day)"
          >
            {{ cell.number }}
          </button>
        </span>
      </div>
    </div>
  </div>
</template>
