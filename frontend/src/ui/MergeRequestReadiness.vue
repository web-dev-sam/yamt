<script setup lang="ts">
import { computed, type Component } from "vue";
import CircleCheck from "~icons/lucide/circle-check";
import CircleSlash from "~icons/lucide/circle-slash";
import GitCompareArrows from "~icons/lucide/git-compare-arrows";
import GitMergeConflict from "~icons/lucide/git-merge-conflict";
import Hourglass from "~icons/lucide/hourglass";

import type { Readiness } from "../ipc";
import { readinessIcon, readinessText, type ReadinessIcon } from "../mergeRequests";

type ReadinessLook = { readonly icon: Component; readonly tone: string };

const props = defineProps<{ readiness: Readiness }>();

const LOOKS: Readonly<Record<ReadinessIcon, ReadinessLook>> = {
  "circle-check": { icon: CircleCheck, tone: "text-success-signal" },
  "git-merge-conflict": { icon: GitMergeConflict, tone: "text-problem-error" },
  "git-compare-arrows": { icon: GitCompareArrows, tone: "text-problem-warning" },
  hourglass: { icon: Hourglass, tone: "text-fg-muted" },
  "circle-slash": { icon: CircleSlash, tone: "text-fg-muted" },
};

const look = computed(() => LOOKS[readinessIcon(props.readiness)]);
const text = computed(() => readinessText(props.readiness));
</script>

<template>
  <span role="img" class="flex p-1" :class="look.tone" :title="text" :aria-label="text">
    <component :is="look.icon" class="size-4" aria-hidden="true" />
  </span>
</template>
