<script setup lang="ts">
import { shallowRef, watch } from "vue";
import ChevronRight from "~icons/lucide/chevron-right";

import type { AgentClient, EditDiff, FileEdit } from "../agent";
import {
  diffFailureText,
  editTitle,
  moreLinesText,
  skippedLinesText,
  TOO_LARGE_TEXT,
} from "./aiText";
import { createdFileLines, editDiffLines, type DiffRow } from "./editDiffLines";

type Shown =
  | { readonly kind: "loading" }
  | { readonly kind: "rows"; readonly rows: readonly DiffRow[] }
  | { readonly kind: "note"; readonly text: string };

const props = defineProps<{ edit: FileEdit; client: AgentClient }>();

const LOADING_TEXT = "Making the diff…";
const SIGNS: Readonly<Record<"context" | "removed" | "added", string>> = {
  context: " ",
  removed: "−",
  added: "+",
};
const ROW_CLASSES: Readonly<Record<DiffRow["kind"], string>> = {
  context: "",
  removed: "bg-chunk-deleted",
  added: "bg-chunk-inserted",
  skipped: "text-fg-muted",
  more: "text-fg-muted",
};

const opened = shallowRef(false);
const shown = shallowRef<Shown | null>(null);

watch(
  () => props.edit,
  (edit) => {
    shown.value = null;
    if (opened.value) {
      void load(edit);
    }
  },
);

function shownOf(edit: FileEdit, diff: EditDiff): Shown {
  switch (diff.kind) {
    case "differences":
      return {
        kind: "rows",
        rows: editDiffLines(edit.oldText ?? "", edit.newText, diff.differences),
      };
    case "tooLarge":
      return { kind: "note", text: TOO_LARGE_TEXT };
    case "appFailed":
    case "failed":
      return { kind: "note", text: diffFailureText(diff, navigator.platform) };
    default: {
      const _exhaustive: never = diff;
      return _exhaustive;
    }
  }
}

async function load(edit: FileEdit): Promise<void> {
  if (edit.oldText === null) {
    shown.value = { kind: "rows", rows: createdFileLines(edit.newText) };
    return;
  }
  shown.value = { kind: "loading" };
  const diff = await props.client.editDiff(edit);
  if (props.edit === edit) {
    shown.value = shownOf(edit, diff);
  }
}

function toggle(): void {
  opened.value = !opened.value;
  if (opened.value && shown.value === null) {
    void load(props.edit);
  }
}

function sign(row: DiffRow): string {
  return row.kind === "context" || row.kind === "removed" || row.kind === "added"
    ? SIGNS[row.kind]
    : "";
}

function oldNumber(row: DiffRow): string {
  return row.kind === "context" || row.kind === "removed" ? String(row.old) : "";
}

function newNumber(row: DiffRow): string {
  return row.kind === "context" || row.kind === "added" ? String(row.new) : "";
}

function rowText(row: DiffRow): string {
  switch (row.kind) {
    case "context":
    case "removed":
    case "added":
      return row.text;
    case "skipped":
      return `⋯ ${skippedLinesText(row.lines)}`;
    case "more":
      return moreLinesText(row.lines);
    default: {
      const _exhaustive: never = row;
      return _exhaustive;
    }
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1">
    <button
      type="button"
      :aria-expanded="opened"
      class="flex min-w-0 items-center gap-1 self-start rounded px-1 py-0.5 text-left hover:bg-hover"
      @click="toggle"
    >
      <ChevronRight
        class="size-3.5 shrink-0 transition-transform"
        :class="{ 'rotate-90': opened }"
        aria-hidden="true"
      />
      <span class="min-w-0 font-mono break-all">{{ editTitle(edit) }}</span>
    </button>
    <template v-if="opened && shown !== null">
      <p v-if="shown.kind === 'loading'" class="pl-5 text-fg-muted">{{ LOADING_TEXT }}</p>
      <p v-else-if="shown.kind === 'note'" class="pl-5 text-fg-muted">{{ shown.text }}</p>
      <div
        v-else
        class="max-h-96 overflow-auto rounded border border-control-border opaque-scroller font-mono"
      >
        <div
          v-for="(row, index) in shown.rows"
          :key="index"
          class="grid min-w-max grid-cols-[3.5rem_3.5rem_1.25rem_auto] whitespace-pre"
          :class="ROW_CLASSES[row.kind]"
        >
          <span class="pr-2 text-right text-fg-muted select-none">{{ oldNumber(row) }}</span>
          <span class="pr-2 text-right text-fg-muted select-none">{{ newNumber(row) }}</span>
          <span class="select-none">{{ sign(row) }}</span>
          <span class="pr-2">{{ rowText(row) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
