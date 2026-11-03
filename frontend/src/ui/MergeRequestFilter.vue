<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch, type Component } from "vue";
import Check from "~icons/lucide/check";
import ChevronDown from "~icons/lucide/chevron-down";
import CircleMinus from "~icons/lucide/circle-minus";
import Tag from "~icons/lucide/tag";
import UserRound from "~icons/lucide/user-round";
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
import {
  clearFilterTitle,
  narrowLabel,
  narrowPlaceholder,
  notValueLabel,
} from "./mergeRequestsText";
import { vTooltip } from "./tooltip";
import { useShiftHeld } from "./useShiftHeld";

type Value = PersonValue | LabelValue;
type Item = {
  readonly key: string;
  readonly choice: Choice<Value>;
  readonly excluded: boolean;
  readonly minusTone: string | null;
  readonly name: string | undefined;
};

const props = defineProps<{
  filter: ListFilter;
  label: string;
  set: boolean;
  choices: readonly Choice<Value>[];
  open: boolean;
  above: boolean;
}>();
const emit = defineEmits<{
  click: [value: Value, shift: boolean];
  clear: [];
  openerClick: [];
  pointerEnter: [];
  pointerLeave: [];
  menuKey: [event: KeyboardEvent];
}>();

const ICONS: Readonly<Record<ListFilter, Component>> = {
  assignee: UserRound,
  reviewer: UserRound,
  label: Tag,
};

const opener = useTemplateRef<HTMLButtonElement>("opener");
const menu = useTemplateRef<HTMLDivElement>("menu");
const narrowBox = useTemplateRef<HTMLInputElement>("narrowBox");
const typed = shallowRef("");
const shift = useShiftHeld();
defineExpose({ opener, menu, narrowBox });

const name = computed(() => filterName(props.filter));
const narrows = computed(() => props.choices.length > NARROW_FROM);
const items = computed(() =>
  (narrows.value ? narrowed(props.choices, typed.value) : props.choices).map(item),
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      typed.value = "";
    }
  },
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

function item(choice: Choice<Value>): Item {
  const excluded = choice.state === "excluded";
  return {
    key: keyOf(choice.value),
    choice,
    excluded,
    minusTone: excluded ? "text-problem-error" : shift.value ? "text-fg-muted" : null,
    name: excluded ? notValueLabel(choice.label) : undefined,
  };
}
</script>

<template>
  <div
    class="relative flex items-center"
    @pointerenter="emit('pointerEnter')"
    @pointerleave="emit('pointerLeave')"
  >
    <button
      ref="opener"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      class="flex items-center gap-1.5 border border-control-border py-1 pr-2 pl-2.5 hover:bg-hover aria-expanded:bg-row-selected"
      :class="set ? 'rounded-l border-primary' : 'rounded'"
      @click="emit('openerClick')"
    >
      <component :is="ICONS[filter]" class="size-4" aria-hidden="true" />
      {{ label }}
      <ChevronDown class="size-3.5" aria-hidden="true" />
    </button>
    <button
      v-if="set"
      v-tooltip="clearFilterTitle(name)"
      type="button"
      :aria-label="clearFilterTitle(name)"
      class="self-stretch rounded-r border border-l-0 border-primary px-1.5 hover:bg-hover"
      @click="emit('clear')"
    >
      <X class="size-3.5" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      ref="menu"
      class="absolute left-0 z-10 flex max-h-[60vh] min-w-56 flex-col rounded border border-control-border bg-panel-inline p-1 shadow-lg"
      :class="above ? 'bottom-full' : 'top-full'"
      @keydown="emit('menuKey', $event)"
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
        <li v-for="entry in items" :key="entry.key" role="none">
          <button
            type="button"
            role="menuitemcheckbox"
            :aria-checked="entry.choice.state !== 'off'"
            :aria-label="entry.name"
            class="flex w-full items-center gap-2 rounded py-1 pr-2 pl-1.5 text-left whitespace-nowrap outline-none hover:bg-hover focus:bg-row-selected"
            @click="emit('click', entry.choice.value, $event.shiftKey)"
          >
            <CircleMinus
              v-if="entry.minusTone !== null"
              class="size-4 shrink-0"
              :class="entry.minusTone"
              aria-hidden="true"
            />
            <span v-else class="size-4 shrink-0" aria-hidden="true" />
            <Check
              v-if="entry.choice.state === 'included'"
              class="size-4 shrink-0"
              aria-hidden="true"
            />
            <span v-else class="size-4 shrink-0" aria-hidden="true" />
            <span class="truncate" :class="{ 'text-problem-error line-through': entry.excluded }">{{
              entry.choice.label
            }}</span>
            <span class="ml-auto pl-3 text-fg-muted">{{ entry.choice.count }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
