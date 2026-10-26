<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue";
import ChevronRight from "~icons/lucide/chevron-right";

import type { AgentClient, TurnEnd, TurnView } from "../agent";
import AiStep from "./AiStep.vue";
import { failureText, RETRY, RUNNING_TEXT, STOPPED_TEXT, THINKING_AND_STEPS } from "./aiText";
import { useMarkdown } from "./useMarkdown";

const props = defineProps<{ turn: TurnView; end: TurnEnd | null; client: AgentClient }>();
const emit = defineEmits<{ retry: [] }>();

const answer = useTemplateRef<HTMLDivElement>("answer");
const opened = shallowRef(false);
useMarkdown(answer, () => props.turn.answer);

const running = computed(() => props.end === null);
const failure = computed(() =>
  props.end?.kind === "failed" ? failureText(props.end.failure, navigator.platform) : null,
);
const hasSteps = computed(() => running.value || props.turn.entries.length > 0);
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <section v-if="hasSteps" class="flex min-w-0 flex-col gap-1">
      <button
        type="button"
        :aria-expanded="opened"
        class="flex items-center gap-1 self-start rounded px-1 py-0.5 text-fg-muted hover:bg-hover"
        @click="opened = !opened"
      >
        <ChevronRight
          class="size-3.5 shrink-0 transition-transform"
          :class="{ 'rotate-90': opened }"
          aria-hidden="true"
        />
        {{ THINKING_AND_STEPS }}
        <span v-if="running" class="text-primary">{{ RUNNING_TEXT }}</span>
      </button>
      <ol v-if="opened" class="flex min-w-0 flex-col gap-2 border-l border-control-border pl-3">
        <template v-for="(entry, index) in turn.entries" :key="index">
          <li
            v-if="entry.kind === 'thought'"
            class="wrap-break-word whitespace-pre-wrap text-fg-muted italic"
          >
            {{ entry.text.trim() }}
          </li>
          <li v-else-if="entry.kind === 'said'" class="wrap-break-word whitespace-pre-wrap">
            {{ entry.text.trim() }}
          </li>
          <AiStep v-else :step="entry.step" :client="client" />
        </template>
      </ol>
    </section>
    <div ref="answer" class="min-w-0 wrap-break-word select-text empty:hidden"></div>
    <p v-if="end?.kind === 'stopped'" class="text-fg-muted">{{ STOPPED_TEXT }}</p>
    <div v-else-if="failure !== null" class="flex min-w-0 items-baseline gap-2">
      <p class="min-w-0 wrap-break-word text-problem-error">{{ failure }}</p>
      <button
        type="button"
        class="shrink-0 rounded border border-control-border px-2 py-0.5 hover:bg-hover"
        @click="emit('retry')"
      >
        {{ RETRY }}
      </button>
    </div>
  </div>
</template>
