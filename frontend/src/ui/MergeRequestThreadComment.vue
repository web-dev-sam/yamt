<script setup lang="ts">
import { computed } from "vue";
import Crown from "~icons/lucide/crown";

import type { DiscussionThread } from "../ipc";
import { agoText, dateTimeText, noteAuthorName } from "../mergeRequests";
import MergeRequestDescriptionBlocks from "./MergeRequestDescriptionBlocks.vue";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import { AUTHOR, editedText } from "./mergeRequestThreadText";
import { vTooltip } from "./tooltip";

type Comment = DiscussionThread["comments"][number];

const props = defineProps<{
  comment: Comment;
  /** The merge request's author's username (null: unknown). */
  author: string | null;
  now: number;
}>();

const username = computed(() => props.comment.author?.username ?? null);
const name = computed(() => noteAuthorName(props.comment.author));
const isAuthor = computed(() => username.value !== null && username.value === props.author);
const written = computed(() => ({
  ago: agoText(props.comment.createdAt, props.now),
  at: dateTimeText(props.comment.createdAt),
}));
const edited = computed(() => {
  const edit = props.comment.edited;
  return edit === null
    ? null
    : { text: editedText(edit, username.value, props.now), at: dateTimeText(edit.at) };
});
</script>

<template>
  <article class="flex flex-col gap-1">
    <header class="flex flex-wrap items-center gap-x-2">
      <MergeRequestPicture :person="comment.author" size="box" aria-hidden="true" />
      <span class="font-semibold">{{ name }}</span>
      <span v-if="isAuthor" v-tooltip="AUTHOR" role="img" :aria-label="AUTHOR" class="flex">
        <Crown class="size-4 text-fg-muted" aria-hidden="true" />
      </span>
      <span v-if="username !== null" class="text-fg-muted">@{{ username }}</span>
      <span v-tooltip="written.at" class="text-fg-muted">{{ written.ago }}</span>
      <span v-if="edited !== null" v-tooltip="edited.at" class="text-fg-muted">{{
        edited.text
      }}</span>
    </header>
    <div class="min-w-0 [overflow-wrap:anywhere]">
      <MergeRequestDescriptionBlocks :blocks="comment.body.blocks" />
    </div>
  </article>
</template>
