<script setup lang="ts">
import { computed, useTemplateRef, watch, type Component } from "vue";
import CircleAlert from "~icons/lucide/circle-alert";
import CircleCheck from "~icons/lucide/circle-check";
import CircleMinus from "~icons/lucide/circle-minus";
import LoaderCircle from "~icons/lucide/loader-circle";
import MessageSquareText from "~icons/lucide/message-square-text";
import RotateCcw from "~icons/lucide/rotate-ccw";

import type { MergeRequestRow, Reviewer } from "../ipc";
import {
  displayName,
  moreText,
  NO_PEOPLE_TEXT,
  peopleStack,
  reviewDone,
  reviewStateText,
  type ReviewState,
} from "../mergeRequests";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import type { RerequestAsk } from "./mergeRequests";
import {
  ASSIGNEES,
  REREQUEST_REVIEW,
  rerequestLabel,
  rerequestReplyText,
  REVIEWERS,
} from "./mergeRequestsText";
import { vTooltip } from "./tooltip";
import { useHoverBox } from "./useHoverBox";

type StateLook = { readonly icon: Component; readonly tone: string };
type ReviewerLine = {
  readonly reviewer: Reviewer;
  readonly name: string;
  readonly look: StateLook;
  readonly stateText: string;
  readonly rerequest: { readonly label: string; readonly running: boolean } | null;
  readonly refusal: string | null;
};

const props = defineProps<{ row: MergeRequestRow; asks: ReadonlyMap<string, RerequestAsk> }>();
const emit = defineEmits<{ rerequestReview: [username: string]; closed: [] }>();

const REVIEW_STATE_LOOKS: Readonly<Record<ReviewState, StateLook>> = {
  requested: { icon: CircleMinus, tone: "text-fg-muted" },
  reviewed: { icon: MessageSquareText, tone: "text-primary" },
  approved: { icon: CircleCheck, tone: "text-success-signal" },
  changesRequested: { icon: CircleAlert, tone: "text-problem-error" },
};

const area = useTemplateRef<HTMLSpanElement>("area");
const opener = useTemplateRef<HTMLButtonElement>("opener");
const box = useTemplateRef<HTMLDivElement>("box");
const { open, placement, on } = useHoverBox({
  area: () => area.value,
  opener: () => opener.value,
  box,
});

const stack = computed(() => {
  const { assignees } = props.row;
  const people = new Map(
    [...assignees, ...props.row.reviewers.map(({ person }) => person)].map((person) => [
      person.username,
      person,
    ]),
  );
  const { shown, more } = peopleStack(assignees, props.row.reviewers);
  return { shown: shown.flatMap(({ username }) => people.get(username) ?? []), more };
});
const reviewers = computed(() => props.row.reviewers.map(reviewerLine));

watch(open, (isOpen) => {
  if (!isOpen) {
    emit("closed");
  }
});

function reviewerLine(reviewer: Reviewer): ReviewerLine {
  const name = displayName(reviewer.person);
  const ask = props.asks.get(reviewer.person.username);
  return {
    reviewer,
    name,
    look: REVIEW_STATE_LOOKS[reviewer.state],
    stateText: reviewStateText(reviewer.state),
    rerequest:
      props.row.mayRerequest && reviewDone(reviewer.state)
        ? { label: rerequestLabel(name), running: ask?.kind === "running" }
        : null,
    refusal: ask?.kind === "refused" ? rerequestReplyText(ask.reply, name) : null,
  };
}
</script>

<template>
  <MergeRequestPicture
    v-if="stack.shown.length === 0"
    v-tooltip="NO_PEOPLE_TEXT"
    :person="null"
    size="stack"
    role="img"
    :aria-label="NO_PEOPLE_TEXT"
  />
  <span
    v-else
    ref="area"
    data-row-control
    class="flex cursor-default"
    @click.stop
    @pointerenter="on.pointerenter"
    @pointerleave="on.pointerleave"
    @focusin="on.focusin"
    @focusout="on.focusout"
    @keydown="on.keydown"
  >
    <button
      ref="opener"
      type="button"
      :aria-expanded="open"
      class="flex items-center rounded p-0.5 hover:bg-hover"
    >
      <MergeRequestPicture
        v-for="(person, index) in stack.shown"
        :key="person.username"
        :person="person"
        size="stack"
        role="img"
        :aria-label="displayName(person)"
        class="ring-2 ring-panel"
        :class="{ '-ml-1.5': index > 0 }"
      />
      <span v-if="stack.more > 0" class="pl-1 text-xs text-fg-muted">{{
        moreText(stack.more)
      }}</span>
    </button>
    <div
      v-if="open"
      ref="box"
      class="fixed z-10 max-h-[60vh] w-max max-w-[30rem] overflow-y-auto rounded-md border border-control-border bg-panel-inline p-1 text-fg shadow-lg"
      :style="placement"
    >
      <template v-if="row.assignees.length > 0">
        <p class="px-2 pt-1 pb-0.5 text-fg-muted">{{ ASSIGNEES }}</p>
        <ul :aria-label="ASSIGNEES">
          <li
            v-for="person in row.assignees"
            :key="person.username"
            class="flex items-center gap-2 px-2 py-1"
          >
            <MergeRequestPicture :person="person" size="box" aria-hidden="true" />
            <span>{{ displayName(person) }}</span>
          </li>
        </ul>
      </template>
      <template v-if="reviewers.length > 0">
        <p class="px-2 pt-1 pb-0.5 text-fg-muted">{{ REVIEWERS }}</p>
        <ul :aria-label="REVIEWERS">
          <li v-for="line in reviewers" :key="line.reviewer.person.username" class="px-2 py-0.5">
            <div class="flex items-center gap-2">
              <MergeRequestPicture :person="line.reviewer.person" size="box" aria-hidden="true" />
              <span>{{ line.name }}</span>
              <span class="ml-auto flex items-center gap-0.5 pl-4">
                <button
                  v-if="line.rerequest !== null"
                  v-tooltip="REREQUEST_REVIEW"
                  type="button"
                  :aria-label="line.rerequest.label"
                  :aria-busy="line.rerequest.running"
                  :disabled="line.rerequest.running"
                  class="rounded p-1 hover:bg-hover enabled:cursor-pointer disabled:text-fg-muted disabled:hover:bg-transparent"
                  @click="emit('rerequestReview', line.reviewer.person.username)"
                >
                  <LoaderCircle
                    v-if="line.rerequest.running"
                    class="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  <RotateCcw v-else class="size-4" aria-hidden="true" />
                </button>
                <span
                  v-tooltip="line.stateText"
                  role="img"
                  :aria-label="line.stateText"
                  class="flex p-1"
                  :class="line.look.tone"
                >
                  <component :is="line.look.icon" class="size-4" aria-hidden="true" />
                </span>
              </span>
            </div>
            <p v-if="line.refusal !== null" role="status" class="max-w-80 pb-1 text-problem-error">
              {{ line.refusal }}
            </p>
          </li>
        </ul>
      </template>
    </div>
  </span>
</template>
