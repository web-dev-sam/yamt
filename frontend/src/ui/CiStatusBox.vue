<script setup lang="ts">
import { computed, useTemplateRef, type Component } from "vue";
import CircleCheck from "~icons/lucide/circle-check";
import CircleDot from "~icons/lucide/circle-dot";
import CircleMinus from "~icons/lucide/circle-minus";
import CircleSlash from "~icons/lucide/circle-slash";
import CircleX from "~icons/lucide/circle-x";
import Clock from "~icons/lucide/clock";
import Cog from "~icons/lucide/cog";

import type { MergeRequestRow, WebPage } from "../ipc";
import { ciBox, ciStatusText, type CiStatusName } from "../mergeRequests";
import {
  ALLOWED_TO_FAIL,
  FAILED_JOBS_TITLE,
  jobTitle,
  MORE_FAILED_JOBS,
} from "./mergeRequestsText";
import { vTooltip } from "./tooltip";
import { useHoverBox } from "./useHoverBox";

type Pipeline = NonNullable<MergeRequestRow["pipeline"]>;
type FailedJob = Pipeline["failedJobs"][number];
type StatusLook = { readonly icon: Component; readonly tone: string };

const props = defineProps<{ pipeline: Pipeline }>();
const emit = defineEmits<{ openJob: [page: WebPage] }>();

const LOOKS: Readonly<Record<CiStatusName, StatusLook>> = {
  passed: { icon: CircleCheck, tone: "text-success-signal" },
  failed: { icon: CircleX, tone: "text-problem-error" },
  running: { icon: CircleDot, tone: "text-primary" },
  pending: { icon: Clock, tone: "text-problem-warning" },
  canceled: { icon: CircleSlash, tone: "text-fg-muted" },
  skipped: { icon: CircleMinus, tone: "text-fg-muted" },
  manual: { icon: Cog, tone: "text-fg-muted" },
};

const area = useTemplateRef<HTMLSpanElement>("area");
const icon = useTemplateRef<HTMLButtonElement>("icon");
const box = useTemplateRef<HTMLDivElement>("box");
const { open, placement, on } = useHoverBox({
  area: () => area.value,
  opener: () => icon.value,
  box,
});

const look = computed(() => LOOKS[props.pipeline.status]);
const view = computed(() =>
  ciBox(props.pipeline.status, props.pipeline.failedJobs, props.pipeline.moreFailedJobs),
);
const statusText = computed(() => ciStatusText(props.pipeline.status));

function openJob({ page }: FailedJob): void {
  if (page !== null) {
    emit("openJob", page);
  }
}
</script>

<template>
  <span
    ref="area"
    class="flex"
    @pointerenter="on.pointerenter"
    @pointerleave="on.pointerleave"
    @focusin="on.focusin"
    @focusout="on.focusout"
    @keydown="on.keydown"
  >
    <button
      ref="icon"
      type="button"
      :aria-label="statusText"
      :aria-expanded="open"
      class="rounded p-1 hover:bg-hover"
      :class="look.tone"
    >
      <component :is="look.icon" class="size-4" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      ref="box"
      role="group"
      :aria-label="statusText"
      class="fixed z-10 max-h-[60vh] w-max max-w-[30rem] overflow-y-auto rounded-md border border-control-border bg-panel-inline p-1 text-fg shadow-lg"
      :style="placement"
    >
      <p v-if="view.kind === 'status'" class="px-2 py-1">{{ view.text }}</p>
      <template v-else>
        <p class="px-2 pt-1 pb-0.5 text-fg-muted">{{ FAILED_JOBS_TITLE }}</p>
        <ul>
          <li v-for="(job, index) in view.jobs" :key="index">
            <button
              v-tooltip="jobTitle(job.name, job.page)"
              type="button"
              :disabled="job.page === null"
              class="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left outline-none hover:bg-hover focus:bg-row-selected disabled:hover:bg-transparent"
              @click="openJob(job)"
            >
              <span>{{ job.name }}</span>
              <span class="text-fg-muted">{{ job.stage }}</span>
              <span v-if="job.allowFailure" class="ml-auto pl-2 text-problem-warning">
                {{ ALLOWED_TO_FAIL }}
              </span>
            </button>
          </li>
        </ul>
        <p v-if="view.more" class="px-2 pt-0.5 pb-1 text-fg-muted">{{ MORE_FAILED_JOBS }}</p>
      </template>
    </div>
  </span>
</template>
