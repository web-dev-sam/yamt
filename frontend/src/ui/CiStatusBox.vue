<script setup lang="ts">
import { useElementBounding } from "@vueuse/core";
import { computed, shallowRef, useTemplateRef, watch, type Component } from "vue";
import CircleCheck from "~icons/lucide/circle-check";
import CircleDot from "~icons/lucide/circle-dot";
import CircleMinus from "~icons/lucide/circle-minus";
import CircleSlash from "~icons/lucide/circle-slash";
import CircleX from "~icons/lucide/circle-x";
import Clock from "~icons/lucide/clock";
import Cog from "~icons/lucide/cog";

import type { MergeRequestRow, WebPage } from "../ipc";
import { ciBox, ciStatusText, type CiStatusName } from "../mergeRequests";
import CiStatusJobLog from "./CiStatusJobLog.vue";
import { useMergeRequests } from "./mergeRequestsStore";
import {
  ALLOWED_TO_FAIL,
  FAILED_JOBS_TITLE,
  jobTitle,
  MORE_FAILED_JOBS,
} from "./mergeRequestsText";
import { isTypingTarget } from "./rangeKeys";
import { vTooltip } from "./tooltip";
import { useHoverBox } from "./useHoverBox";
import { useShiftTaps } from "./useShiftHeld";

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

const { jobLog, showJobLog, closeJobLog } = useMergeRequests();
const area = useTemplateRef<HTMLSpanElement>("area");
const icon = useTemplateRef<HTMLButtonElement>("icon");
const box = useTemplateRef<HTMLDivElement>("box");
const { open, placement, on } = useHoverBox({
  area: () => area.value,
  opener: () => icon.value,
  box,
});
const boxBounds = useElementBounding(box);
const pointed = shallowRef<FailedJob | null>(null);
const focused = shallowRef<FailedJob | null>(null);

const look = computed(() => LOOKS[props.pipeline.status]);
const view = computed(() =>
  ciBox(props.pipeline.status, props.pipeline.failedJobs, props.pipeline.moreFailedJobs),
);
const statusText = computed(() => ciStatusText(props.pipeline.status));
const ownLog = computed(() => {
  const shown = jobLog.value;
  return shown !== null && props.pipeline.failedJobs.some(({ page }) => page === shown.job.page)
    ? shown
    : null;
});
const anchor = computed(() => ({ left: boxBounds.left.value, top: boxBounds.top.value }));

watch(useShiftTaps(), () => {
  const job = pointed.value ?? focused.value;
  if (!open.value || job === null || job.page === null || isTypingTarget(document.activeElement)) {
    return;
  }
  void showJobLog({ name: job.name, page: job.page });
});
watch(open, (now) => {
  if (!now && ownLog.value !== null) {
    closeJobLog();
  }
});

function openJob({ page }: FailedJob): void {
  if (page !== null) {
    emit("openJob", page);
  }
}

function point(job: FailedJob): void {
  pointed.value = job;
}

function unpoint(job: FailedJob): void {
  if (pointed.value === job) {
    pointed.value = null;
  }
}

function focus(job: FailedJob): void {
  focused.value = job;
}

function unfocus(job: FailedJob): void {
  if (focused.value === job) {
    focused.value = null;
  }
}

function logClosed(): void {
  const page = ownLog.value?.job.page;
  closeJobLog();
  const index =
    view.value.kind === "jobs" ? view.value.jobs.findIndex((job) => job.page === page) : -1;
  box.value?.querySelectorAll<HTMLButtonElement>("li > button")[index]?.focus();
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
          <li
            v-for="(job, index) in view.jobs"
            :key="index"
            v-tooltip="jobTitle(job.name, job.page)"
            @pointerenter="point(job)"
            @pointerleave="unpoint(job)"
          >
            <button
              type="button"
              :disabled="job.page === null"
              aria-keyshortcuts="Shift"
              class="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left outline-none hover:bg-hover focus:bg-row-selected disabled:pointer-events-none"
              @click="openJob(job)"
              @focus="focus(job)"
              @blur="unfocus(job)"
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
    <CiStatusJobLog
      v-if="open && ownLog !== null"
      :key="ownLog.job.page"
      :shown="ownLog"
      :anchor
      @close="logClosed"
      @open-job="emit('openJob', $event)"
    />
  </span>
</template>
