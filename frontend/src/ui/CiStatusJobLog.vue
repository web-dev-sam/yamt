<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue";

import type { WebPage } from "../ipc";
import {
  firstHit,
  firstLineBelow,
  hitCountText,
  hitPlaces,
  NO_RESULTS,
  placesOnLines,
  steppedHit,
  type HitPlace,
} from "../mergeRequests";
import { matcherOf } from "../search";
import type { ShownJobLog } from "./mergeRequestJobLogs";
import { runClasses } from "./mergeRequestLogLook";
import {
  JOB_LOG_CUT,
  JOB_LOG_LOADING,
  JOB_LOG_SEARCH,
  JOB_LOG_WHOLE,
  jobLogRefusalText,
  jobLogTitle,
} from "./mergeRequestLogText";
import { useMergeRequests } from "./mergeRequestsStore";
import { problemText } from "./problemText";
import { useFollowEnd } from "./useFollowEnd";
import { useBesidePlacement } from "./useMenuPlacement";

const props = defineProps<{
  shown: ShownJobLog;
  anchor: { readonly left: number; readonly top: number };
}>();
const emit = defineEmits<{ close: []; openJob: [page: WebPage] }>();

const MATCHES = "job-log-match";
const CURRENT = "job-log-current";
const HALF = 0.5;

const { jobSearch, setJobSearch } = useMergeRequests();
const box = useTemplateRef<HTMLDivElement>("box");
const field = useTemplateRef<HTMLInputElement>("field");
const scroller = useTemplateRef<HTMLDivElement>("scroller");
const lines = useTemplateRef<HTMLDivElement>("lines");
const query = shallowRef(jobSearch(props.shown.job.name));
const places = shallowRef<readonly HitPlace[]>([]);
const current = shallowRef<number | null>(null);
// WebKitGTK 2.54 does not repaint the ranges of a Highlight that `CSS.highlights.set` replaces: they
// stay painted (finding 2191). Clearing the registered Highlight repaints them, so each name keeps
// one Highlight for the box's life.
const matches = new Highlight();
const currentMatch = new Highlight();
let frame: number | null = null;
const placement = useBesidePlacement(box, () => props.anchor);
const follow = useFollowEnd(scroller, () => props.shown.load);

const title = computed(() => jobLogTitle(props.shown.job.name));
const loaded = computed(() => (props.shown.load.kind === "shown" ? props.shown.load : null));
const answered = computed(
  () => props.shown.load.kind === "refused" || props.shown.load.kind === "failed",
);
const note = computed((): string | null => {
  const load = props.shown.load;
  switch (load.kind) {
    case "loading":
      return JOB_LOG_LOADING;
    case "refused":
      return jobLogRefusalText(load.reply);
    case "failed":
      return problemText(
        { action: "mergeRequests", step: "jobLog", cause: load.cause },
        navigator.platform,
      );
    case "shown":
      return null;
    default: {
      const _exhaustive: never = load;
      return _exhaustive;
    }
  }
});
const countText = computed(() => {
  if (query.value === "" || loaded.value === null) {
    return "";
  }
  return current.value === null ? NO_RESULTS : hitCountText(current.value, places.value.length);
});

watch(loaded, search, { flush: "post" });
watch(answered, leaveField, { flush: "post" });

onMounted(() => {
  CSS.highlights.set(MATCHES, matches);
  CSS.highlights.set(CURRENT, currentMatch);
  field.value?.focus();
  field.value?.select();
  leaveField();
  search();
});

onBeforeUnmount(() => {
  if (frame !== null) {
    cancelAnimationFrame(frame);
  }
  CSS.highlights.delete(MATCHES);
  CSS.highlights.delete(CURRENT);
});

function leaveField(): void {
  if (answered.value && document.activeElement === field.value) {
    scroller.value?.focus();
  }
}

function rangeOf(place: HitPlace): Range | null {
  const line = lines.value?.children[place.line];
  const start = line?.children[place.start.run]?.firstChild;
  const end = line?.children[place.end.run]?.firstChild;
  if (start === undefined || start === null || end === undefined || end === null) {
    return null;
  }
  const range = new Range();
  range.setStart(start, place.start.offset);
  range.setEnd(end, place.end.offset);
  return range;
}

function centre(range: Range): void {
  const element = scroller.value;
  if (element !== null) {
    const hit = range.getBoundingClientRect();
    const view = element.getBoundingClientRect();
    element.scrollTop +=
      hit.top + hit.height * HALF - (view.top + element.clientTop + element.clientHeight * HALF);
  }
}

function showCurrent(): void {
  const place = current.value === null ? undefined : places.value[current.value];
  const range = place === undefined ? null : rangeOf(place);
  currentMatch.clear();
  if (range !== null) {
    currentMatch.add(range);
    centre(range);
  }
}

function bottomOf(rows: HTMLCollection, line: number): number {
  const row = rows[line];
  return row instanceof HTMLElement ? row.offsetTop + row.offsetHeight : Infinity;
}

function topOf(rows: HTMLCollection, line: number): number {
  const row = rows[line];
  return row instanceof HTMLElement ? row.offsetTop : Infinity;
}

function paintMatches(): void {
  const element = scroller.value;
  const rows = lines.value?.children;
  matches.clear();
  if (element !== null && rows !== undefined) {
    const screen = element.clientHeight;
    const above = element.scrollTop - screen;
    const below = element.scrollTop + screen + screen;
    const first = firstLineBelow(rows.length, (line) => bottomOf(rows, line), above);
    const end = firstLineBelow(rows.length, (line) => topOf(rows, line), below);
    for (const place of placesOnLines(places.value, first, end)) {
      const range = rangeOf(place);
      if (range !== null) {
        matches.add(range);
      }
    }
  }
}

function paintSoon(): void {
  frame ??= requestAnimationFrame(() => {
    frame = null;
    paintMatches();
  });
}

function search(): void {
  const view = loaded.value?.view;
  const hits =
    view === undefined
      ? []
      : (matcherOf({ text: query.value, matchCase: false })?.hits(view.text, Infinity).hits ?? []);
  places.value = view === undefined ? [] : hitPlaces(view, hits);
  current.value = firstHit(places.value.length);
  showCurrent();
  paintMatches();
}

function scrolled(): void {
  follow.scrolled();
  paintSoon();
}

function typed(event: Event): void {
  if (event.target instanceof HTMLInputElement) {
    query.value = event.target.value;
    setJobSearch(props.shown.job.name, query.value);
    search();
  }
}

function fieldKey(event: KeyboardEvent): void {
  if (event.key === "Enter" && current.value !== null) {
    event.preventDefault();
    current.value = steppedHit(current.value, places.value.length, event.shiftKey);
    showCurrent();
    paintSoon();
  }
}

function keydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  }
}
</script>

<template>
  <div
    ref="box"
    role="dialog"
    :aria-label="title"
    class="fixed z-10 flex h-[min(36rem,calc(100vh-2rem))] w-[min(56rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border border-control-border text-fg shadow-lg"
    :style="placement"
    @keydown="keydown"
  >
    <div class="flex items-center gap-2 bg-panel-inline px-2 py-1">
      <span class="min-w-0 truncate">{{ title }}</span>
      <input
        ref="field"
        type="text"
        spellcheck="false"
        :value="query"
        :aria-label="JOB_LOG_SEARCH"
        :placeholder="JOB_LOG_SEARCH"
        class="ml-auto w-72 rounded border border-control-border bg-panel px-2 py-1 outline-none focus:border-primary"
        @input="typed"
        @keydown="fieldKey"
      />
      <span aria-live="polite" class="w-24 shrink-0 text-fg-muted">{{ countText }}</span>
    </div>
    <div
      ref="scroller"
      tabindex="0"
      class="relative min-h-0 flex-1 overflow-y-auto bg-panel px-2 py-1 font-mono [overflow-wrap:anywhere] whitespace-pre-wrap"
      @scroll="scrolled"
    >
      <p v-if="note !== null">{{ note }}</p>
      <template v-else-if="loaded !== null">
        <p v-if="loaded.cut" class="text-fg-muted">
          {{ JOB_LOG_CUT }}
          <button
            type="button"
            class="rounded px-1 text-primary hover:bg-hover"
            @click="emit('openJob', shown.job.page)"
          >
            {{ JOB_LOG_WHOLE }}
          </button>
        </p>
        <div ref="lines">
          <div v-for="(line, index) in loaded.view.lines" :key="index">
            <span v-for="(run, at) in line.runs" :key="at" :class="runClasses(run.style)">{{
              run.text
            }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style>
::highlight(job-log-match) {
  background-color: var(--color-search-match);
}

::highlight(job-log-current) {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}
</style>
