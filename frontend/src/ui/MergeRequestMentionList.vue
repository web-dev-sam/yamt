<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { computed, useTemplateRef, watch } from "vue";

import {
  mentionOptionId,
  mentionPlace,
  type MentionAnchor,
  type MentionList,
} from "./mergeRequestMentionLines";
import MergeRequestPicture from "./MergeRequestPicture.vue";
import { MENTION_PEOPLE } from "./mergeRequestsText";

const props = defineProps<{
  list: MentionList;
  highlight: number;
  listId: string;
  anchor: MentionAnchor;
}>();
const emit = defineEmits<{ pick: [index: number] }>();

const content = useTemplateRef<HTMLDivElement>("content");
const size = useElementSize(content, undefined, { box: "border-box" });

const place = computed(() => {
  const { left, top, maxHeight } = mentionPlace(props.anchor, {
    width: size.width.value,
    height: size.height.value,
  });
  return { left: `${left}px`, top: `${top}px`, maxHeight: `${maxHeight}px` };
});
const activeId = computed(() => mentionOptionId(props.listId, props.highlight));

watch(
  activeId,
  (id) => {
    document.getElementById(id)?.scrollIntoView({ block: "nearest" });
  },
  { flush: "post" },
);
</script>

<template>
  <div class="absolute z-10 overflow-y-auto rounded-md shadow-lg" :style="place">
    <div
      ref="content"
      class="w-max max-w-80 rounded-md border border-control-border bg-panel-inline p-1"
    >
      <ul :id="listId" role="listbox" :aria-label="MENTION_PEOPLE">
        <li
          v-for="(line, index) in list.lines"
          :id="mentionOptionId(listId, index)"
          :key="line.username"
          role="option"
          :aria-selected="index === highlight"
          class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-hover aria-selected:bg-row-selected"
          @mousedown.prevent
          @click="emit('pick', index)"
        >
          <MergeRequestPicture :person="line.picture" size="box" aria-hidden="true" />
          <span>{{ line.label }}</span>
          <span class="text-fg-muted">@{{ line.username }}</span>
        </li>
      </ul>
      <p v-if="list.note !== null" role="status" class="px-2 py-1 text-fg-muted">
        {{ list.note }}
      </p>
    </div>
  </div>
</template>
