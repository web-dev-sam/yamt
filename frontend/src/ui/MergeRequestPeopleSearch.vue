<script setup lang="ts">
import { computed, onMounted, shallowRef, useId, useTemplateRef, watch } from "vue";
import LoaderCircle from "~icons/lucide/loader-circle";

import type { MergeRequestRow, PeopleGroup } from "../ipc";
import { ARROW_STEPS } from "./menuKeys";
import {
  keptHighlight,
  pickList,
  steppedHighlight,
  type PickLine,
} from "./mergeRequestPeopleLines";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import { rowPeopleAsks } from "./mergeRequests";
import { useMergeRequests } from "./mergeRequestsStore";
import { alreadyText, SEARCH_PEOPLE, SEARCH_PEOPLE_PLACEHOLDER } from "./mergeRequestsText";

const props = defineProps<{ row: MergeRequestRow; group: PeopleGroup }>();
const emit = defineEmits<{ close: [] }>();

const { rows, me, peopleSearch, peopleAsks, searchPeople, changePeople } = useMergeRequests();
const field = useTemplateRef<HTMLInputElement>("field");
const listId = useId();
const text = shallowRef("");
const highlight = shallowRef<number | null>(null);

const list = computed(() =>
  pickList({
    rows: rows.value,
    row: props.row,
    group: props.group,
    me: me.value,
    search: peopleSearch.value,
    asks: rowPeopleAsks(peopleAsks.value, props.row.iid),
    platform: navigator.platform,
  }),
);
const activeId = computed(() => (highlight.value === null ? undefined : optionId(highlight.value)));
const already = computed(() => alreadyText(props.group));

watch(
  () => list.value.lines,
  (lines, before) => {
    highlight.value = keptHighlight(before ?? [], lines, highlight.value);
  },
  { immediate: true },
);
watch(
  activeId,
  (id) => {
    if (id !== undefined) {
      document.getElementById(id)?.scrollIntoView({ block: "nearest" });
    }
  },
  { flush: "post" },
);

onMounted(() => {
  field.value?.focus();
});

function optionId(index: number): string {
  return `${listId}-${index}`;
}

function typed(event: Event): void {
  if (event.target instanceof HTMLInputElement) {
    text.value = event.target.value;
    searchPeople(text.value);
  }
}

async function add(line: PickLine): Promise<void> {
  if (line.state !== "addable") {
    return;
  }
  const typedAtPick = text.value;
  await changePeople(props.row.iid, {
    group: props.group,
    action: "add",
    username: line.username,
  });
  if (field.value !== null && text.value === typedAtPick) {
    text.value = "";
    searchPeople("");
    if (document.activeElement === document.body) {
      field.value.focus();
    }
  }
}

function fieldKey(event: KeyboardEvent): void {
  const step = ARROW_STEPS[event.key];
  if (step !== undefined) {
    event.preventDefault();
    highlight.value = steppedHighlight(list.value.lines, highlight.value, step);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const line = highlight.value === null ? undefined : list.value.lines[highlight.value];
    if (line !== undefined) {
      void add(line);
    }
  } else if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  }
}
</script>

<template>
  <div class="px-2 pb-1">
    <input
      ref="field"
      type="text"
      role="combobox"
      spellcheck="false"
      autocomplete="off"
      aria-autocomplete="list"
      aria-expanded="true"
      :aria-controls="listId"
      :aria-activedescendant="activeId"
      :aria-label="SEARCH_PEOPLE"
      :placeholder="SEARCH_PEOPLE_PLACEHOLDER"
      :value="text"
      class="w-64 rounded border border-control-border bg-panel px-2 py-1 outline-none focus:border-primary"
      @input="typed"
      @keydown="fieldKey"
    />
    <ul :id="listId" role="listbox" :aria-label="SEARCH_PEOPLE" class="pt-1">
      <li
        v-for="(line, index) in list.lines"
        :id="optionId(index)"
        :key="line.username"
        role="option"
        :aria-selected="index === highlight"
        :aria-disabled="line.state !== 'addable'"
        class="flex items-center gap-2 rounded px-2 py-1 not-aria-disabled:cursor-pointer not-aria-disabled:hover:bg-hover aria-selected:bg-row-selected"
        @mousedown.prevent
        @click="add(line)"
      >
        <MergeRequestPicture :person="line.picture" size="box" aria-hidden="true" />
        <span>{{ line.label }}</span>
        <span class="text-fg-muted">@{{ line.username }}</span>
        <span v-if="line.state === 'already'" class="ml-auto pl-4 text-fg-muted">{{
          already
        }}</span>
        <LoaderCircle
          v-else-if="line.state === 'working'"
          class="ml-auto size-4 animate-spin"
          aria-hidden="true"
        />
      </li>
    </ul>
    <p
      v-if="list.note !== null"
      role="status"
      class="max-w-80 px-2 py-1"
      :class="list.note.failed ? 'text-problem-error' : 'text-fg-muted'"
    >
      {{ list.note.text }}
    </p>
  </div>
</template>
