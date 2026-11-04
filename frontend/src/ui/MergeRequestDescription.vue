<script setup lang="ts">
import { onClickOutside, useEventListener } from "@vueuse/core";
import { computed, onMounted, useId, useTemplateRef } from "vue";
import X from "~icons/lucide/x";

import type { DescriptionBlock } from "../ipc";
import { RETRY } from "./aiText";
import { returnFocus } from "./focusReturn";
import MergeRequestDescriptionBlocks from "./MergeRequestDescriptionBlocks.vue";
import type { DescriptionLoad, ShownDescription } from "./mergeRequestDescriptions";
import {
  CLOSE_DESCRIPTION,
  DESCRIPTION_LOADING,
  descriptionRefusalText,
  NO_DESCRIPTION,
} from "./mergeRequestDescriptionText";
import { useMergeRequests } from "./mergeRequestsStore";
import { mergeRequestReference } from "./mergeRequestsText";
import type { Problem } from "./problem";
import { problemText } from "./problemText";
import { vTooltip } from "./tooltip";

type Content =
  | { readonly kind: "blocks"; readonly blocks: readonly DescriptionBlock[] }
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "refusal"; readonly text: string };

const props = defineProps<{ shown: ShownDescription; asking: boolean }>();

const { closeDescription, retryDescription } = useMergeRequests();
const panel = useTemplateRef<HTMLDivElement>("panel");
const titleId = useId();
onClickOutside(panel, closeDescription, {
  ignore: ["[data-description-opener]", "[data-refreshes-list]"],
});
useEventListener(window, "keydown", keyPressed, { capture: true });

const reference = computed(() => mergeRequestReference(props.shown.row.iid));
const content = computed(() => contentOf(props.shown.load));

onMounted(() => {
  panel.value?.focus();
});

function contentOf(load: DescriptionLoad): Content {
  switch (load.kind) {
    case "loading":
      return { kind: "note", text: DESCRIPTION_LOADING };
    case "shown":
      return load.description.blocks.length === 0
        ? { kind: "note", text: NO_DESCRIPTION }
        : { kind: "blocks", blocks: load.description.blocks };
    case "refused":
      return { kind: "refusal", text: descriptionRefusalText(load.reply) };
    case "failed": {
      const problem: Problem = { action: "mergeRequests", step: "description", cause: load.cause };
      return { kind: "refusal", text: problemText(problem, navigator.platform) };
    }
  }
}

async function closeToOpener(): Promise<void> {
  const opener = document.querySelector(`[data-description-opener="${props.shown.row.iid}"]`);
  closeDescription();
  await returnFocus(opener);
}

function keyPressed(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.defaultPrevented || props.asking) {
    return;
  }
  event.preventDefault();
  void closeToOpener();
}
</script>

<template>
  <div
    ref="panel"
    role="dialog"
    aria-modal="false"
    :aria-labelledby="titleId"
    tabindex="-1"
    class="fixed top-1/2 left-1/2 z-20 flex max-h-[85vh] w-[min(64rem,calc(100vw-4rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-md border border-control-border bg-panel-inline text-fg shadow-lg outline-none"
  >
    <header class="flex shrink-0 items-center gap-2 border-b border-separator px-3 py-2">
      <h2 :id="titleId" class="flex min-w-0 flex-1 gap-2 font-semibold">
        <span class="shrink-0 text-fg-muted">{{ reference }}</span>
        <span class="truncate">{{ shown.row.title }}</span>
      </h2>
      <button
        v-tooltip="CLOSE_DESCRIPTION"
        type="button"
        :aria-label="CLOSE_DESCRIPTION"
        class="shrink-0 cursor-pointer rounded p-1 hover:bg-hover"
        @click="closeToOpener"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </header>
    <div class="min-h-0 overflow-y-auto overscroll-contain px-4 py-3">
      <MergeRequestDescriptionBlocks v-if="content.kind === 'blocks'" :blocks="content.blocks" />
      <p v-else-if="content.kind === 'note'" class="text-fg-muted">{{ content.text }}</p>
      <p v-else role="alert" class="flex items-center gap-3">
        <span class="text-problem-error">{{ content.text }}</span>
        <button
          type="button"
          class="shrink-0 cursor-pointer rounded border border-control-border px-3.5 py-1 hover:bg-hover"
          @click="retryDescription"
        >
          {{ RETRY }}
        </button>
      </p>
    </div>
  </div>
</template>
