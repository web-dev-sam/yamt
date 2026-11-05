<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import Check from "~icons/lucide/check";
import ChevronDown from "~icons/lucide/chevron-down";
import ChevronRight from "~icons/lucide/chevron-right";

import {
  agoText,
  dateTimeText,
  laterWriters,
  noteAuthorName,
  placeText,
  turnText,
  type Viewer,
} from "../mergeRequests";
import MergeRequestDescriptionBlocks from "./MergeRequestDescriptionBlocks.vue";
import type { PersonEntryShown } from "./mergeRequestPersonView";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import { useMergeRequests } from "./mergeRequestsStore";
import {
  COLLAPSE_THREAD,
  EXPAND_THREAD,
  mergeRequestReference,
  SHOW_THREAD_KEY,
} from "./mergeRequestsText";
import type { Thread } from "./mergeRequestThread";
import MergeRequestThreadBody from "./MergeRequestThreadBody.vue";
import MergeRequestThreadButtons from "./MergeRequestThreadButtons.vue";
import { RESOLVED } from "./mergeRequestThreadText";
import MergeRequestWriters from "./MergeRequestWriters.vue";
import { vTooltip } from "./tooltip";

const props = defineProps<{
  entry: PersonEntryShown;
  person: Viewer;
  now: number;
  expanded: boolean;
  thread: Thread | null;
}>();

const TURN_MARK = "font-semibold text-primary";

const { expandEntry, collapseEntry } = useMergeRequests();
const host = useTemplateRef<HTMLElement>("host");
const chevron = useTemplateRef<HTMLButtonElement>("chevron");
defineExpose({ focusChevron });

const discussion = computed(() => props.entry.discussion);
const starter = computed(() => (discussion.value.earlier[0] ?? discussion.value.last).author);
const written = computed(() => ({
  ago: agoText(discussion.value.first.createdAt, props.now),
  at: dateTimeText(discussion.value.first.createdAt),
}));
const turn = computed(() => ({
  text: turnText(props.entry.turn, props.person, props.entry.row.author),
  look: props.entry.group === "turn" ? TURN_MARK : "text-fg-muted",
}));
const writers = computed(() => laterWriters(discussion.value));
const chevronLabel = computed(() => (props.expanded ? COLLAPSE_THREAD : EXPAND_THREAD));
const author = computed(() => props.entry.row.author?.username ?? null);

function focusChevron(): void {
  chevron.value?.focus();
}

function focusHost(): void {
  host.value?.focus();
}

function toggle(): void {
  if (props.expanded) {
    collapseEntry(discussion.value.id);
    return;
  }
  expandEntry(props.entry.row.iid, discussion.value.id);
}
</script>

<template>
  <article ref="host" tabindex="-1" class="flex gap-2 px-3 py-2 outline-none">
    <button
      ref="chevron"
      v-tooltip="chevronLabel"
      type="button"
      :aria-expanded="expanded"
      :aria-label="chevronLabel"
      class="h-max shrink-0 rounded p-0.5 hover:bg-hover"
      @click="toggle"
    >
      <ChevronDown v-if="expanded" class="size-4" aria-hidden="true" />
      <ChevronRight v-else class="size-4" aria-hidden="true" />
    </button>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <header
        v-tooltip="expanded ? null : SHOW_THREAD_KEY"
        class="flex min-w-0 items-center gap-x-2"
      >
        <MergeRequestPicture :person="starter" size="box" aria-hidden="true" />
        <span class="shrink-0 font-semibold">{{ noteAuthorName(starter) }}</span>
        <span v-tooltip="written.at" class="shrink-0 text-fg-muted">{{ written.ago }}</span>
        <span class="min-w-0 truncate text-fg-muted"
          >{{ mergeRequestReference(entry.row.iid) }} {{ entry.row.title }}</span
        >
        <span class="shrink-0 text-fg-muted">{{ placeText(discussion.place) }}</span>
        <template v-if="expanded">
          <span v-if="entry.resolved" class="ml-auto flex shrink-0 items-center gap-1 text-fg-muted"
            ><Check class="size-4" aria-hidden="true" />{{ RESOLVED }}</span
          >
          <span v-else class="ml-auto shrink-0" :class="turn.look">{{ turn.text }}</span>
          <span v-if="thread !== null" class="flex shrink-0 items-center gap-2">
            <MergeRequestThreadButtons :thread="thread" @focus-host="focusHost" />
          </span>
        </template>
      </header>
      <div v-if="expanded" class="flex flex-col">
        <MergeRequestThreadBody
          v-if="thread !== null"
          :thread="thread"
          :author="author"
          :now="now"
          placement="inline"
          @cancel="focusChevron"
          @focus-host="focusHost"
        />
      </div>
      <template v-else>
        <div class="max-h-20 min-w-0 overflow-hidden leading-5 [overflow-wrap:anywhere]">
          <MergeRequestDescriptionBlocks :blocks="discussion.first.body.blocks" />
        </div>
        <div class="flex min-h-5 items-center gap-3">
          <MergeRequestWriters :writers="writers" />
          <span v-if="entry.resolved" class="ml-auto flex shrink-0 items-center gap-1 text-fg-muted"
            ><Check class="size-4" aria-hidden="true" />{{ RESOLVED }}</span
          >
          <span v-else class="ml-auto shrink-0" :class="turn.look">{{ turn.text }}</span>
        </div>
      </template>
    </div>
  </article>
</template>
