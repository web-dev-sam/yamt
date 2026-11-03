<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import Check from "~icons/lucide/check";
import UserRoundSearch from "~icons/lucide/user-round-search";

import { filterName, type Choice, type ReviewFor } from "../mergeRequests";
import MenuNarrowing from "./MenuNarrowing.vue";
import { REVIEW_MODE } from "./mergeRequestsText";
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
const box = useTemplateRef("box");

const menu = computed(() => box.value?.menu ?? null);
const narrowBox = computed(() => box.value?.narrowBox ?? null);
defineExpose({ opener, menu, narrowBox });

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
    <MenuNarrowing
      ref="box"
      :choices="choices"
      :name="REVIEWER"
      :open="open"
      :above="above"
      @menu-key="emit('menuKey', $event)"
    >
      <template #default="{ shown }">
        <ul role="menu" :aria-label="REVIEW_MODE" class="min-h-0 overflow-y-auto">
          <li v-for="choice in shown" :key="keyOf(choice.value)" role="none">
            <button
              type="button"
              role="menuitemradio"
              :aria-checked="choice.state === 'included'"
              class="flex w-full items-center gap-2 rounded py-1 pr-2 pl-1.5 text-left whitespace-nowrap outline-none hover:bg-hover focus:bg-row-selected"
              @click="emit('pick', choice.value)"
            >
              <Check
                v-if="choice.state === 'included'"
                class="size-4 shrink-0"
                aria-hidden="true"
              />
              <span v-else class="size-4 shrink-0" aria-hidden="true" />
              <span class="truncate">{{ choice.label }}</span>
              <span class="ml-auto pl-3 text-fg-muted">{{ choice.count }}</span>
            </button>
          </li>
        </ul>
      </template>
    </MenuNarrowing>
  </div>
</template>
