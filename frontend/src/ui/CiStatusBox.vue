<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { computed, shallowRef, useTemplateRef, type Component } from "vue";
import CircleCheck from "~icons/lucide/circle-check";
import CircleDot from "~icons/lucide/circle-dot";
import CircleMinus from "~icons/lucide/circle-minus";
import CircleSlash from "~icons/lucide/circle-slash";
import CircleX from "~icons/lucide/circle-x";
import Clock from "~icons/lucide/clock";
import Cog from "~icons/lucide/cog";

import type { MergeRequestRow, WebPage } from "../ipc";
import { ciBox, ciStatusText, type CiStatusName } from "../mergeRequests";
import type { Point } from "./menuPosition";
import {
  ALLOWED_TO_FAIL,
  FAILED_JOBS_TITLE,
  jobTitle,
  MORE_FAILED_JOBS,
} from "./mergeRequestsText";
import { belowLeft, useMenuPlacement } from "./useMenuPlacement";

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
const open = shallowRef(false);
const at = shallowRef<Point>({ x: 0, y: 0 });
const placement = useMenuPlacement(box, at);
let pointerInside = false;
let focusInside = false;
useEventListener(window, "scroll", scrolled, { capture: true, passive: true });

const look = computed(() => LOOKS[props.pipeline.status]);
const view = computed(() =>
  ciBox(props.pipeline.status, props.pipeline.failedJobs, props.pipeline.moreFailedJobs),
);
const statusText = computed(() => ciStatusText(props.pipeline.status));

function show(): void {
  if (!open.value && icon.value !== null) {
    at.value = belowLeft(icon.value);
    open.value = true;
  }
}

function hideUnlessHeld(): void {
  if (!pointerInside && !focusInside) {
    open.value = false;
  }
}

function pointerEntered(): void {
  pointerInside = true;
  show();
}

function pointerLeft(): void {
  pointerInside = false;
  hideUnlessHeld();
}

function isInside(target: EventTarget | null): boolean {
  return target instanceof Node && area.value?.contains(target) === true;
}

function focusEntered(event: FocusEvent): void {
  if (!isInside(event.relatedTarget)) {
    focusInside = true;
    show();
  }
}

function focusLeft(event: FocusEvent): void {
  if (!isInside(event.relatedTarget)) {
    focusInside = false;
    hideUnlessHeld();
  }
}

function keyPressed(event: KeyboardEvent): void {
  if (event.key === "Escape" && open.value) {
    event.preventDefault();
    open.value = false;
    icon.value?.focus();
  }
}

function scrolled(event: Event): void {
  if (open.value && !isInside(event.target)) {
    focusInside = document.activeElement === icon.value;
    open.value = false;
  }
}

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
    @pointerenter="pointerEntered"
    @pointerleave="pointerLeft"
    @focusin="focusEntered"
    @focusout="focusLeft"
    @keydown="keyPressed"
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
              type="button"
              :title="jobTitle(job.name, job.page)"
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
