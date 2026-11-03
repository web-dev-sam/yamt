<script setup lang="ts">
import { computed, useTemplateRef, watch } from "vue";
import MessageSquare from "~icons/lucide/message-square";

import type { MergeRequestRow, WebPage } from "../ipc";
import {
  agoText,
  discussionTurns,
  DISCUSSIONS_LABEL,
  noteAuthorName,
  noteExcerpt,
  placeText,
  turnCounts,
  turnSummaryText,
  turnText,
} from "../mergeRequests";
import type { DiscussionLoad } from "./mergeRequestDiscussions";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import { useMergeRequests } from "./mergeRequestsStore";
import { discussionsRefusedText, discussionsText, DISCUSSIONS_LOADING } from "./mergeRequestsText";
import { problemText } from "./problemText";
import { vTooltip } from "./tooltip";
import { useHoverBox } from "./useHoverBox";

type Header = { readonly text: string; readonly failed: boolean };

const props = defineProps<{ row: MergeRequestRow; now: number }>();

const { discussions, discussionDetails, askDiscussions, me, openPage } = useMergeRequests();
const area = useTemplateRef<HTMLSpanElement>("area");
const opener = useTemplateRef<HTMLButtonElement>("opener");
const box = useTemplateRef<HTMLDivElement>("box");
const { open, placement, on } = useHoverBox({
  area: () => area.value,
  opener: () => opener.value,
  box,
});

const count = computed(() => props.row.openDiscussions);
const label = computed(() => discussionsText(count.value));
const boxed = computed(() => discussionDetails.value !== "off" && count.value > 0);
const load = computed(() => discussions.value.get(props.row.iid));
const header = computed(() => headerOf(load.value));
const lines = computed(() =>
  load.value?.kind === "read"
    ? discussionTurns(load.value.discussions, me.value).map(({ discussion, turn }, index) => ({
        key: index,
        page: discussion.last.page,
        author: discussion.last.author,
        name: noteAuthorName(discussion.last.author),
        ago: agoText(discussion.last.createdAt, props.now),
        turn: turnText(turn),
        viewersTurn: turn === "viewer",
        place: placeText(discussion.place),
        excerpt: noteExcerpt(discussion.last.text),
      }))
    : [],
);

watch(open, (isOpen) => {
  if (isOpen) {
    askDiscussions(props.row.iid);
  }
});

function headerOf(shown: DiscussionLoad | undefined): Header {
  if (shown === undefined) {
    return { text: DISCUSSIONS_LOADING, failed: false };
  }
  switch (shown.kind) {
    case "loading":
      return { text: DISCUSSIONS_LOADING, failed: false };
    case "read":
      return { text: turnSummaryText(turnCounts(shown.discussions, me.value)), failed: false };
    case "refused":
      return { text: discussionsRefusedText(shown.answer), failed: true };
    case "failed":
      return {
        text: problemText(
          { action: "mergeRequests", step: "discussions", cause: shown.cause },
          navigator.platform,
        ),
        failed: true,
      };
    default: {
      const _exhaustive: never = shown;
      return _exhaustive;
    }
  }
}

async function openLine(page: WebPage | null): Promise<void> {
  if (page !== null) {
    await openPage("discussion", page);
  }
}
</script>

<template>
  <span
    v-if="!boxed"
    v-tooltip="label"
    class="flex items-center gap-1"
    :class="{ 'text-fg-muted': count === 0 }"
    :aria-label="label"
  >
    <MessageSquare class="size-4" aria-hidden="true" />
    <span aria-hidden="true">{{ count }}</span>
  </span>
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
      :aria-label="label"
      class="flex items-center gap-1 rounded p-0.5 hover:bg-hover"
    >
      <MessageSquare class="size-4" aria-hidden="true" />
      <span aria-hidden="true">{{ count }}</span>
    </button>
    <div
      v-if="open"
      ref="box"
      tabindex="-1"
      class="fixed z-10 max-h-[60vh] w-max max-w-[30rem] overflow-y-auto rounded-md border border-control-border bg-panel-inline p-1 text-fg shadow-lg outline-none"
      :style="placement"
    >
      <p
        role="status"
        class="px-2 pt-1 pb-0.5"
        :class="header.failed ? 'text-problem-error' : 'text-fg-muted'"
      >
        {{ header.text }}
      </p>
      <ul :aria-label="DISCUSSIONS_LABEL">
        <li v-for="line in lines" :key="line.key">
          <component
            :is="line.page === null ? 'div' : 'button'"
            :type="line.page === null ? undefined : 'button'"
            class="block w-full rounded px-2 py-1 text-left"
            :class="{ 'cursor-pointer hover:bg-hover': line.page !== null }"
            @click="openLine(line.page)"
          >
            <span class="flex items-center gap-2">
              <MergeRequestPicture :person="line.author" size="box" aria-hidden="true" />
              <span>{{ line.name }}</span>
              <span class="text-fg-muted">{{ line.ago }}</span>
              <span
                class="ml-auto pl-4"
                :class="line.viewersTurn ? 'font-semibold text-primary' : 'text-fg-muted'"
                >{{ line.turn }}</span
              >
            </span>
            <span class="block wrap-break-word text-fg-muted">{{ line.place }}</span>
            <span class="line-clamp-3 wrap-break-word whitespace-pre-line">{{ line.excerpt }}</span>
          </component>
        </li>
      </ul>
    </div>
  </span>
</template>
