<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import Check from "~icons/lucide/check";
import UserRoundSearch from "~icons/lucide/user-round-search";

import { filterName, NARROW_FROM, narrowed, type Choice, type ReviewFor } from "../mergeRequests";
import { narrowLabel, narrowPlaceholder, REVIEW_MODE } from "./mergeRequestsText";
import { vTooltip } from "./tooltip";

const props = defineProps<{
  choices: readonly Choice<ReviewFor>[];
  active: boolean;
  open: boolean;
  above: boolean;
}>();
const emit = defineEmits<{
  pick: [value: ReviewFor];
  openerClick: [];
  pointerEnter: [];
  pointerLeave: [];
  menuKey: [event: KeyboardEvent];
}>();

const REVIEWER = filterName("reviewer");

const opener = useTemplateRef<HTMLButtonElement>("opener");
const menu = useTemplateRef<HTMLDivElement>("menu");
const narrowBox = useTemplateRef<HTMLInputElement>("narrowBox");
const typed = shallowRef("");
defineExpose({ opener, menu, narrowBox });

const narrows = computed(() => props.choices.length > NARROW_FROM);
const shown = computed(() =>
  narrows.value ? narrowed(props.choices, typed.value) : props.choices,
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      typed.value = "";
    }
  },
);

function keyOf(value: ReviewFor): string {
  return value.kind === "me" ? value.kind : `user:${value.username}`;
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
      v-tooltip="REVIEW_MODE"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="REVIEW_MODE"
      class="flex items-center gap-1.5 rounded border border-control-border py-1 pr-2 pl-2.5 hover:bg-hover aria-expanded:bg-row-selected"
      :class="{ 'border-primary': active }"
      @click="emit('openerClick')"
    >
      <UserRoundSearch class="size-4" aria-hidden="true" />
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
        :aria-label="narrowLabel(REVIEWER)"
        :placeholder="narrowPlaceholder(REVIEWER)"
        spellcheck="false"
        class="mb-1 rounded border border-control-border bg-panel px-2 py-1 outline-none focus:border-primary"
      />
      <ul role="menu" :aria-label="REVIEW_MODE" class="min-h-0 overflow-y-auto">
        <li v-for="choice in shown" :key="keyOf(choice.value)" role="none">
          <button
            type="button"
            role="menuitemradio"
            :aria-checked="choice.state === 'included'"
            class="flex w-full items-center gap-2 rounded py-1 pr-2 pl-1.5 text-left whitespace-nowrap outline-none hover:bg-hover focus:bg-row-selected"
            @click="emit('pick', choice.value)"
          >
            <Check v-if="choice.state === 'included'" class="size-4 shrink-0" aria-hidden="true" />
            <span v-else class="size-4 shrink-0" aria-hidden="true" />
            <span class="truncate">{{ choice.label }}</span>
            <span class="ml-auto pl-3 text-fg-muted">{{ choice.count }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
