<script setup lang="ts">
import { computed, type Component } from "vue";
import Check from "~icons/lucide/check";
import MessageSquare from "~icons/lucide/message-square";
import RefreshCcwDot from "~icons/lucide/refresh-ccw-dot";

import type { RangeChange, RangeEntry, ReviewMark } from "../ipc";
import RangeCounts from "./RangeCounts.vue";
import { changeMark, REVIEW_MARK_WORDS } from "./rangeText";
import { threadCountText } from "./rangeThreadText";

type ReviewLook = {
  readonly icon: Component;
  readonly colour: string;
  readonly mutesName: boolean;
};

type ReviewShown = ReviewLook & { readonly word: string };

const props = defineProps<{
  file: RangeEntry;
  label: string;
  threads: number;
  review: ReviewMark | null;
}>();

const LETTER_COLOURS: Readonly<Record<RangeChange["kind"], string>> = {
  added: "text-success-signal",
  modified: "text-chunk-modified-removal",
  deleted: "text-problem-error",
  renamed: "text-problem-warning",
};

const REVIEW_LOOKS: Readonly<Record<ReviewMark, ReviewLook>> = {
  reviewed: { icon: Check, colour: "text-fg-muted", mutesName: true },
  changedSinceReview: { icon: RefreshCcwDot, colour: "text-problem-warning", mutesName: false },
};

const mark = computed(() => changeMark(props.file.change));
const letterColour = computed(() => LETTER_COLOURS[props.file.change.kind]);
const oldPath = computed(() =>
  props.file.change.kind === "renamed" ? props.file.change.oldPath : null,
);
const threadsTitle = computed(() => threadCountText(props.threads));
const reviewShown = computed((): ReviewShown | null =>
  props.review === null
    ? null
    : { ...REVIEW_LOOKS[props.review], word: REVIEW_MARK_WORDS[props.review] },
);
</script>

<template>
  <span
    role="img"
    :title="mark.word"
    :aria-label="mark.word"
    class="w-3 shrink-0 text-center font-semibold"
    :class="letterColour"
  >
    {{ mark.letter }}
  </span>
  <span class="truncate" :class="{ 'text-fg-muted': reviewShown?.mutesName === true }">{{
    label
  }}</span>
  <span v-if="oldPath !== null" class="min-w-0 truncate text-fg-muted">{{ oldPath }}</span>
  <span
    v-if="threads > 0"
    role="img"
    :title="threadsTitle"
    :aria-label="threadsTitle"
    class="ml-auto flex shrink-0 items-center gap-0.5 text-fg-muted tabular-nums"
  >
    <MessageSquare class="size-3.5" aria-hidden="true" />
    {{ threads }}
  </span>
  <RangeCounts :lines="file.lines" :class="{ 'ml-auto': threads === 0 }" />
  <span
    v-if="reviewShown !== null"
    role="img"
    :title="reviewShown.word"
    :aria-label="reviewShown.word"
    class="flex shrink-0"
    :class="reviewShown.colour"
  >
    <component :is="reviewShown.icon" class="size-3.5" aria-hidden="true" />
  </span>
</template>
