<script setup lang="ts" generic="C extends { readonly label: string }">
import { computed, shallowRef, useTemplateRef, watch } from "vue";

import { NARROW_FROM, narrowed } from "../mergeRequests";
import { narrowLabel, narrowPlaceholder } from "./mergeRequestsText";

const props = defineProps<{
  choices: readonly C[];
  name: string;
  open: boolean;
  above: boolean;
}>();
const emit = defineEmits<{ menuKey: [event: KeyboardEvent] }>();
defineSlots<{ default(props: { shown: readonly C[] }): unknown }>();

const menu = useTemplateRef<HTMLDivElement>("menu");
const narrowBox = useTemplateRef<HTMLInputElement>("narrowBox");
const typed = shallowRef("");
defineExpose({ menu, narrowBox });

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
</script>

<template>
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
    <slot :shown="shown" />
  </div>
</template>
