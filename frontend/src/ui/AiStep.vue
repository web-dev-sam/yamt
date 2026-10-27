<script setup lang="ts">
import type { AgentClient, Step, StepStatus } from "../agent";
import { refusedText, STEP_STATUS_WORDS } from "./aiText";
import EditDiff from "./EditDiff.vue";

defineProps<{ step: Step; client: Pick<AgentClient, "editDiff"> }>();

const STATUS_CLASSES: Readonly<Record<StepStatus, string>> = {
  pending: "text-fg-muted",
  running: "text-primary",
  done: "text-fg-muted",
  failed: "text-problem-error",
  noResult: "text-problem-warning",
};
</script>

<template>
  <li class="flex min-w-0 flex-col gap-1">
    <div class="flex min-w-0 items-baseline gap-2">
      <span class="min-w-0 font-medium wrap-break-word">{{ step.title }}</span>
      <span class="shrink-0 text-xs" :class="STATUS_CLASSES[step.status]">
        {{ STEP_STATUS_WORDS[step.status] }}
      </span>
    </div>
    <template v-for="(output, index) in step.outputs" :key="index">
      <pre
        v-if="output.kind === 'text'"
        class="max-h-48 overflow-auto rounded bg-panel-inline px-2 py-1 font-mono text-xs whitespace-pre-wrap"
        >{{ output.text }}</pre>
      <EditDiff v-else-if="output.kind === 'edit'" :edit="output.edit" :client="client" />
      <div v-else class="text-problem-warning">
        <p>{{ refusedText(output.title) }}</p>
        <p v-for="path in output.paths" :key="path" class="font-mono break-all">{{ path }}</p>
      </div>
    </template>
  </li>
</template>
