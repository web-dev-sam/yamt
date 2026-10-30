<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue";
import Check from "~icons/lucide/check";
import ChevronDown from "~icons/lucide/chevron-down";
import X from "~icons/lucide/x";

import {
  filterName,
  NARROW_FROM,
  narrowed,
  type Choice,
  type LabelValue,
  type ListFilter,
  type PersonValue,
} from "../mergeRequests";
import { clearFilterTitle, narrowLabel, narrowPlaceholder } from "./mergeRequestsText";
import { useDropdownMenu } from "./useDropdownMenu";

type Value = PersonValue | LabelValue;

const props = defineProps<{
  filter: ListFilter;
  label: string;
  set: boolean;
  choices: readonly Choice<Value>[];
}>();
const emit = defineEmits<{ toggle: [value: Value]; clear: [] }>();

const opener = useTemplateRef<HTMLButtonElement>("opener");
const menu = useTemplateRef<HTMLDivElement>("menu");
const narrowBox = useTemplateRef<HTMLInputElement>("narrowBox");
const typed = shallowRef("");
const { openFor, above, toggle, menuKey } = useDropdownMenu<ListFilter>({
  menu: () => menu.value,
  opener: () => opener.value,
});

const name = computed(() => filterName(props.filter));
const narrows = computed(() => props.choices.length > NARROW_FROM);
const shown = computed(() =>
  narrows.value ? narrowed(props.choices, typed.value) : props.choices,
);

function keyOf(value: Value): string {
  switch (value.kind) {
    case "me":
    case "none":
      return value.kind;
    case "person":
      return `user:${value.username}`;
    case "label":
      return `label:${value.title}`;
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
}

async function openerClicked(): Promise<void> {
  typed.value = "";
  await toggle(props.filter);
  narrowBox.value?.focus();
}
</script>

<template>
  <div class="relative flex items-center">
    <button
      ref="opener"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="openFor !== null"
      class="flex items-center gap-1 border border-control-border py-1 pr-2 pl-3 hover:bg-hover aria-expanded:bg-row-selected"
      :class="set ? 'rounded-l border-primary' : 'rounded'"
      @click="openerClicked"
    >
      {{ label }}
      <ChevronDown class="size-3.5" aria-hidden="true" />
    </button>
    <button
      v-if="set"
      type="button"
      :title="clearFilterTitle(name)"
      :aria-label="clearFilterTitle(name)"
      class="self-stretch rounded-r border border-l-0 border-primary px-1.5 hover:bg-hover"
      @click="emit('clear')"
    >
      <X class="size-3.5" aria-hidden="true" />
    </button>
    <div
      v-if="openFor !== null"
      ref="menu"
      class="absolute left-0 z-10 flex max-h-[60vh] min-w-56 flex-col rounded border border-control-border bg-panel-inline p-1 shadow-lg"
      :class="above ? 'bottom-full' : 'top-full'"
      @keydown="menuKey"
    >
      <input
        v-if="narrows"
        ref="narrowBox"
        v-model="typed"
        type="search"
        :aria-label="narrowLabel(name)"
        :placeholder="narrowPlaceholder(name)"
        spellcheck="false"
        class="mb-1 rounded border border-control-border bg-panel px-2 py-1 outline-none focus:border-primary"
      />
      <ul role="menu" :aria-label="name" class="min-h-0 overflow-y-auto">
        <li v-for="choice in shown" :key="keyOf(choice.value)" role="none">
          <button
            type="button"
            role="menuitemcheckbox"
            :aria-checked="choice.checked"
            class="flex w-full items-center gap-2 rounded py-1 pr-2 pl-1.5 text-left whitespace-nowrap outline-none hover:bg-hover focus:bg-row-selected"
            @click="emit('toggle', choice.value)"
          >
            <Check v-if="choice.checked" class="size-4 shrink-0" aria-hidden="true" />
            <span v-else class="size-4 shrink-0" aria-hidden="true" />
            <span class="truncate">{{ choice.label }}</span>
            <span class="ml-auto pl-3 text-fg-muted">{{ choice.count }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
