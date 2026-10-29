<script setup lang="ts" generic="P extends string">
import { computed, nextTick, useTemplateRef, watch } from "vue";
import CaseSensitive from "~icons/lucide/case-sensitive";

import { PANE_ICONS } from "./searchIcons";
import type { Searching } from "./searching";
import SearchResults from "./SearchResults.vue";
import {
  CUT_TEXT,
  MATCH_CASE_LABEL,
  PANE_FILTERS_LABEL,
  SEARCH_PLACEHOLDER,
  SEARCH_TITLE,
  summaryText,
} from "./searchText";

type Remembered = { readonly pane: HTMLElement | null; readonly path: string | null };

const props = defineProps<{ search: Searching<P>; shownPath: string | null; whole: boolean }>();

// A pane's focusable element is CodeMirror's content DOM, which always carries these attributes (@codemirror/view `EditorView` contentAttrs); ui/ may not import CodeMirror (PM2).
const PANE_CONTENT = '[role="textbox"][aria-multiline="true"]';

const panel = useTemplateRef<HTMLElement>("panel");
const box = useTemplateRef<HTMLInputElement>("box");
const results = useTemplateRef<{ focusList(): void }>("results");
let remembered: Remembered = { pane: null, path: null };

const summaryLine = computed(() => {
  const summary = props.search.summary.value;
  return summary === null ? null : summaryText(summary);
});
const cut = computed(() => {
  const summary = props.search.summary.value;
  return summary?.kind === "results" && summary.cut;
});

watch(
  () => props.search.shown.value,
  async (shown) => {
    if (!shown) {
      focusBack();
      return;
    }
    const focused = document.activeElement;
    remembered = {
      pane: focused instanceof HTMLElement && focused.matches(PANE_CONTENT) ? focused : null,
      path: props.shownPath,
    };
    await nextTick();
    box.value?.focus();
    box.value?.select();
    // WebKitGTK 2.54.2 moves the caret to the end later in the task the panel appears in, about every other show (observed in SearchWindowR1's WebKit pass).
    requestAnimationFrame(() => {
      box.value?.select();
    });
  },
  { flush: "pre" },
);

function focusBack(): void {
  const focused = document.activeElement;
  const inPanel = focused === null || focused === document.body || panel.value?.contains(focused);
  if (inPanel !== true) {
    return;
  }
  const { pane, path } = remembered;
  if (pane?.isConnected === true && path === props.shownPath) {
    pane.focus();
  }
  if (pane === null || document.activeElement !== pane) {
    props.search.focusShownFile();
  }
}

function typed(event: Event): void {
  if (event.target instanceof HTMLInputElement) {
    props.search.type(event.target.value);
  }
}

function boxKey(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    event.preventDefault();
    props.search.enter();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    results.value?.focusList();
  }
}
</script>

<template>
  <section
    v-show="search.shown.value"
    ref="panel"
    :aria-label="SEARCH_TITLE"
    class="flex min-h-0 shrink-0 flex-col island bg-sidebar pb-1"
    :class="whole ? 'flex-1' : 'max-h-1/2'"
  >
    <div class="flex h-10 shrink-0 items-center pr-2 pl-3">
      <h2 class="font-semibold">{{ SEARCH_TITLE }}</h2>
    </div>
    <div class="relative mx-2 flex shrink-0 items-center">
      <input
        ref="box"
        type="text"
        spellcheck="false"
        :placeholder="SEARCH_PLACEHOLDER"
        :aria-label="SEARCH_PLACEHOLDER"
        :value="search.query.value"
        class="w-full rounded border border-control-border bg-panel-inline py-1 pr-8 pl-2 outline-none focus:border-primary"
        @input="typed"
        @keydown="boxKey"
      />
      <button
        type="button"
        :title="MATCH_CASE_LABEL"
        :aria-label="MATCH_CASE_LABEL"
        :aria-pressed="search.matchCase.value"
        class="absolute right-1 rounded p-0.5 hover:bg-hover aria-pressed:bg-row-selected aria-pressed:hover:brightness-110"
        @mousedown.prevent
        @click="search.toggleMatchCase()"
      >
        <CaseSensitive class="size-4" aria-hidden="true" />
      </button>
    </div>
    <div role="group" :aria-label="PANE_FILTERS_LABEL" class="mx-2 mt-1.5 flex shrink-0 gap-1">
      <button
        v-for="info in search.panes.value"
        :key="info.pane"
        type="button"
        :title="info.title"
        :aria-label="info.title"
        :aria-pressed="search.panesOn.value.has(info.pane)"
        class="rounded p-1 hover:bg-hover aria-pressed:bg-row-selected aria-pressed:hover:brightness-110"
        @mousedown.prevent
        @click="search.togglePane(info.pane)"
      >
        <component :is="PANE_ICONS[info.icon]" class="size-4" aria-hidden="true" />
      </button>
    </div>
    <p v-if="summaryLine !== null" role="status" class="mx-3 mt-1.5 shrink-0 text-fg-muted">
      {{ summaryLine }}
    </p>
    <p v-if="cut" class="mx-3 mt-1 shrink-0 text-fg-muted">{{ CUT_TEXT }}</p>
    <SearchResults
      ref="results"
      class="mt-1"
      :rows="search.rows.value"
      :panes="search.panes.value"
      :full-runs="search.fullRuns.value"
      @toggle="search.toggleGroup"
      @dismiss-place="search.dismissPlace"
      @dismiss-group="search.dismissGroup"
      @go="search.go"
    />
  </section>
</template>
