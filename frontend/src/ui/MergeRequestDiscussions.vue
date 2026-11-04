<script setup lang="ts">
import { useElementBounding } from "@vueuse/core";
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue";
import Check from "~icons/lucide/check";
import MessageSquare from "~icons/lucide/message-square";
import RefreshCw from "~icons/lucide/refresh-cw";

import type { DiscussionId, MergeRequestRow, OpenDiscussion, WebPage } from "../ipc";
import {
  agoText,
  discussionTurns,
  DISCUSSIONS_LABEL,
  noteAuthorName,
  noteExcerpt,
  placeText,
  turnCounts,
  turnOf,
  turnSummaryText,
  turnText,
} from "../mergeRequests";
import { useRowDiscussions, type DiscussionLoad } from "./mergeRequestDiscussions";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import { isBeingRead } from "./mergeRequestsRefresh";
import { useMergeRequests } from "./mergeRequestsStore";
import {
  discussionsFailedText,
  discussionsText,
  DISCUSSIONS_LOADING,
  RELOAD_DISCUSSIONS,
  SHOW_THREAD_KEY,
} from "./mergeRequestsText";
import MergeRequestThread from "./MergeRequestThread.vue";
import { RESOLVED } from "./mergeRequestThreadText";
import { vTooltip } from "./tooltip";
import { isTypingTarget } from "./typingTarget";
import { useHoverBox } from "./useHoverBox";
import { useShiftTaps } from "./useShiftHeld";

type Header = { readonly text: string; readonly failed: boolean };
type Words = { readonly place: string; readonly turn: string };

const props = defineProps<{ row: MergeRequestRow; now: number; asking: boolean }>();

const mergeRequests = useMergeRequests();
const { discussionDetails, viewer, openPage, reloads, thread } = mergeRequests;
const area = useTemplateRef<HTMLSpanElement>("area");
const opener = useTemplateRef<HTMLButtonElement>("opener");
const box = useTemplateRef<HTMLDivElement>("box");
const { open, placement, on, close } = useHoverBox({
  area: () => area.value,
  opener: () => opener.value,
  box,
  pinned: () => shownHere() !== null,
});
const boxBounds = useElementBounding(box);
const load = useRowDiscussions(
  mergeRequests,
  () => props.row.iid,
  () => open.value,
);
const pointed = shallowRef<DiscussionId | null>(null);
const focused = shallowRef<DiscussionId | null>(null);

const shownId = computed(shownHere);
const count = computed(() => props.row.openDiscussions);
const label = computed(() => discussionsText(count.value));
const author = computed(() => props.row.author?.username ?? null);
const boxed = computed(
  () => (discussionDetails.value !== "off" && count.value > 0) || shownId.value !== null,
);
const reload = computed(() => reloads.value.get(props.row.iid));
const spinning = computed(() => {
  if (discussionDetails.value !== "off") {
    return reload.value?.kind === "running";
  }
  const shown = thread.value;
  return shownId.value !== null && shown !== null && isBeingRead(shown.load);
});
const counts = computed(() =>
  turnCounts(unmarkedOf(load.value), viewer.value.username, author.value),
);
const marked = computed(() => counts.value.viewersTurn > 0);
const header = computed(() => headerOf(load.value));
const lines = computed(() => {
  const shown = load.value;
  if (shown?.kind !== "read") {
    return [];
  }
  return discussionTurns(shown.discussions, viewer.value.username, author.value).map(
    ({ discussion, turn }) => ({
      id: discussion.id,
      page: discussion.last.page,
      author: discussion.last.author,
      name: noteAuthorName(discussion.last.author),
      ago: agoText(discussion.last.createdAt, props.now),
      resolved: shown.resolved.has(discussion.id),
      turn: turnText(turn, viewer.value, props.row.author),
      viewersTurn: turn.kind === "viewer",
      place: placeText(discussion.place),
      excerpt: noteExcerpt(discussion.last.text),
    }),
  );
});
const panelWords = computed((): Words => wordsOf(shownDiscussion()));
const anchor = computed(() => ({ left: boxBounds.left.value, top: boxBounds.top.value }));

watch(useShiftTaps(), () => {
  const id = pointed.value ?? focused.value;
  if (!open.value || id === null || isTypingTarget(document.activeElement)) {
    return;
  }
  mergeRequests.showThread(props.row.iid, id);
});
watch(open, (now) => {
  if (!now) {
    boxClosedHere();
  }
});
watch(
  () => thread.value?.shown.iid,
  (iid) => {
    if (open.value && iid !== undefined && iid !== props.row.iid) {
      close();
    }
  },
);

onBeforeUnmount(() => {
  if (open.value) {
    boxClosedHere();
  }
});

function shownHere(): DiscussionId | null {
  const shown = thread.value?.shown;
  return shown?.iid === props.row.iid ? shown.discussion : null;
}

function boxClosedHere(): void {
  pointed.value = null;
  focused.value = null;
  if (shownHere() !== null) {
    mergeRequests.closeThread();
  }
  mergeRequests.boxClosed(props.row.iid);
}

function headerOf(shown: DiscussionLoad | undefined): Header {
  if (shown === undefined) {
    return { text: DISCUSSIONS_LOADING, failed: false };
  }
  switch (shown.kind) {
    case "loading":
      return { text: DISCUSSIONS_LOADING, failed: false };
    case "read":
      return readHeader();
    case "refused":
    case "failed":
      return { text: discussionsFailedText(shown, navigator.platform), failed: true };
    default: {
      const _exhaustive: never = shown;
      return _exhaustive;
    }
  }
}

function unmarkedOf(shown: DiscussionLoad | undefined): readonly OpenDiscussion[] {
  if (shown?.kind !== "read") {
    return [];
  }
  return shown.discussions.filter((discussion) => !shown.resolved.has(discussion.id));
}

function readHeader(): Header {
  const failure = reload.value;
  if (failure !== undefined && failure.kind !== "running") {
    return { text: discussionsFailedText(failure, navigator.platform), failed: true };
  }
  return { text: turnSummaryText(counts.value, viewer.value), failed: false };
}

function shownDiscussion(): OpenDiscussion | null {
  const id = shownId.value;
  const entry = load.value;
  const listed =
    entry?.kind === "read"
      ? entry.discussions.find((discussion) => discussion.id === id)
      : undefined;
  const shownLoad = thread.value?.load;
  return listed ?? (shownLoad?.kind === "read" ? shownLoad.thread.discussion : null);
}

function wordsOf(discussion: OpenDiscussion | null): Words {
  if (discussion === null) {
    return { place: "", turn: "" };
  }
  const turn = turnOf(discussion, viewer.value.username, author.value);
  return {
    place: placeText(discussion.place),
    turn: turnText(turn, viewer.value, props.row.author),
  };
}

async function openLine(page: WebPage | null): Promise<void> {
  if (page !== null) {
    await openPage("discussion", page);
  }
}

function point(id: DiscussionId): void {
  pointed.value = id;
}

function unpoint(): void {
  pointed.value = null;
}

function focus(id: DiscussionId): void {
  focused.value = id;
}

function unfocus(): void {
  focused.value = null;
}

function threadClosed(): void {
  const id = shownId.value;
  mergeRequests.closeThread();
  if (id !== null) {
    box.value?.querySelector<HTMLButtonElement>(`[data-discussion-id="${id}"]`)?.focus();
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
      :class="{ 'font-semibold text-primary': marked }"
    >
      <MessageSquare class="size-4" aria-hidden="true" />
      <span aria-hidden="true">{{ count }}</span>
    </button>
    <div
      v-if="open"
      ref="box"
      tabindex="-1"
      class="fixed z-10 flex max-h-[60vh] w-max max-w-[30rem] flex-col rounded-md border border-control-border bg-panel-inline p-1 text-fg shadow-lg outline-none"
      :style="placement"
    >
      <div class="flex shrink-0 items-start gap-2 pt-1 pr-1 pb-0.5 pl-2">
        <p
          role="status"
          class="flex-1"
          :class="header.failed ? 'text-problem-error' : 'text-fg-muted'"
        >
          {{ header.text }}
        </p>
        <button
          v-tooltip="RELOAD_DISCUSSIONS"
          type="button"
          :aria-label="RELOAD_DISCUSSIONS"
          class="shrink-0 rounded p-0.5 hover:bg-hover"
          @click="mergeRequests.refreshDiscussions(row.iid)"
        >
          <RefreshCw class="size-4" :class="{ 'animate-spin': spinning }" aria-hidden="true" />
        </button>
      </div>
      <ul :aria-label="DISCUSSIONS_LABEL" class="min-h-0 overflow-y-auto">
        <li
          v-for="line in lines"
          :key="line.id"
          @pointerenter="point(line.id)"
          @pointerleave="unpoint"
        >
          <button
            v-tooltip="SHOW_THREAD_KEY"
            type="button"
            :data-discussion-id="line.id"
            aria-keyshortcuts="Shift"
            :aria-disabled="line.page === null ? 'true' : undefined"
            :aria-current="line.id === shownId ? 'true' : undefined"
            class="block w-full rounded px-2 py-1 text-left outline-none not-aria-disabled:cursor-pointer hover:bg-hover focus:bg-row-selected aria-current:bg-row-selected"
            :class="{ 'text-fg-muted': line.resolved }"
            @click="openLine(line.page)"
            @focus="focus(line.id)"
            @blur="unfocus"
          >
            <span class="flex items-center gap-2">
              <MergeRequestPicture :person="line.author" size="box" aria-hidden="true" />
              <span>{{ line.name }}</span>
              {{ " " }}<span class="text-fg-muted">{{ line.ago }}</span> {{ " " }}
              <span v-if="line.resolved" class="ml-auto flex items-center gap-1 pl-4 text-fg-muted"
                ><Check class="size-4" aria-hidden="true" />{{ RESOLVED }}</span
              ><span
                v-else
                class="ml-auto pl-4"
                :class="line.viewersTurn ? 'font-semibold text-primary' : 'text-fg-muted'"
                >{{ line.turn }}</span
              >
            </span>
            {{ " " }}<span class="block wrap-break-word text-fg-muted">{{ line.place }}</span>
            {{ " "
            }}<span class="line-clamp-3 wrap-break-word whitespace-pre-line">{{
              line.excerpt
            }}</span>
          </button>
        </li>
      </ul>
    </div>
    <MergeRequestThread
      v-if="open && shownId !== null"
      :key="shownId"
      :iid="row.iid"
      :author
      :place="panelWords.place"
      :turn="panelWords.turn"
      :anchor
      :now
      :asking
      @close="threadClosed"
    />
  </span>
</template>
