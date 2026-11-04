<script setup lang="ts">
import type { DescriptionInline, DescriptionLink } from "../ipc";
import MergeRequestDescriptionImage from "./MergeRequestDescriptionImage.vue";
import { useMergeRequests } from "./mergeRequestsStore";
import { vTooltip } from "./tooltip";

defineProps<{ inlines: readonly DescriptionInline[] }>();

const LINK_CLASS: Readonly<Record<DescriptionLink["kind"], string>> = {
  page: "cursor-pointer text-syntax-link hover:underline",
  refused: "cursor-default text-fg-muted",
};

const { openPage } = useMergeRequests();

function linkAddress(link: DescriptionLink): string {
  return link.kind === "page" ? link.page : link.address;
}

function linkPressed(link: DescriptionLink): void {
  if (link.kind === "page") {
    void openPage("link", link.page);
  }
}
</script>

<template>
  <template v-for="(inline, index) in inlines" :key="index">
    <template v-if="inline.kind === 'text'">{{ inline.text }}</template>
    <em v-else-if="inline.kind === 'emphasis'">
      <MergeRequestDescriptionInlines :inlines="inline.inlines" />
    </em>
    <strong v-else-if="inline.kind === 'strong'">
      <MergeRequestDescriptionInlines :inlines="inline.inlines" />
    </strong>
    <del v-else-if="inline.kind === 'strike'">
      <MergeRequestDescriptionInlines :inlines="inline.inlines" />
    </del>
    <code v-else-if="inline.kind === 'code'" class="markdown-inline-code">{{ inline.text }}</code>
    <a
      v-else-if="inline.kind === 'link'"
      v-tooltip="linkAddress(inline.link)"
      role="link"
      tabindex="0"
      :class="LINK_CLASS[inline.link.kind]"
      @click="linkPressed(inline.link)"
      @keydown.enter="linkPressed(inline.link)"
    >
      <MergeRequestDescriptionInlines :inlines="inline.inlines" />
    </a>
    <MergeRequestDescriptionImage
      v-else-if="inline.kind === 'image'"
      :image="inline.image"
      :caption="inline.caption"
      :size="inline.size"
    />
    <br v-else />
  </template>
</template>
