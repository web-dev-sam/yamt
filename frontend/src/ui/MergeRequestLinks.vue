<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import ArrowUpToLine from "~icons/lucide/arrow-up-to-line";
import CircleDot from "~icons/lucide/circle-dot";
import GitCommitHorizontal from "~icons/lucide/git-commit-horizontal";
import Layers from "~icons/lucide/layers";
import Link from "~icons/lucide/link";

import type { MergeRequestRow, WebPage } from "../ipc";
import { RETRY } from "./aiText";
import {
  CLOSED,
  linkBox,
  NOT_SHOWN,
  SHOW_LINKS,
  type LinkGroupKind,
} from "./mergeRequestLinkLines";
import { useRowLinks } from "./mergeRequestLinks";
import { useMergeRequests } from "./mergeRequestsStore";
import { vTooltip } from "./tooltip";
import { useHoverBox } from "./useHoverBox";

const props = defineProps<{ row: MergeRequestRow }>();

const mergeRequests = useMergeRequests();
const { askLinks, openPage } = mergeRequests;
const area = useTemplateRef<HTMLSpanElement>("area");
const opener = useTemplateRef<HTMLButtonElement>("opener");
const box = useTemplateRef<HTMLDivElement>("box");
const { open, placement, on, keepFocus } = useHoverBox({
  area: () => area.value,
  opener: () => opener.value,
  box,
});
const load = useRowLinks(
  mergeRequests,
  () => props.row.iid,
  () => open.value,
);
const icons: Readonly<Record<LinkGroupKind, typeof Link>> = {
  epics: Layers,
  issues: CircleDot,
  commits: GitCommitHorizontal,
};

const shown = computed(() => linkBox(load.value, navigator.platform));
const groups = computed(() => (shown.value.kind === "groups" ? shown.value.groups : []));

function retry(): void {
  keepFocus();
  askLinks(props.row.iid);
}

async function openLink(page: WebPage): Promise<void> {
  await openPage("link", page);
}
</script>

<template>
  <span
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
      :aria-label="SHOW_LINKS"
      class="flex rounded p-1 hover:bg-hover"
    >
      <Link class="size-4" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      ref="box"
      tabindex="-1"
      class="fixed z-10 max-h-[60vh] w-max max-w-[30rem] overflow-y-auto rounded-md border border-control-border bg-panel-inline p-1 text-fg shadow-lg outline-none"
      :style="placement"
    >
      <template v-if="shown.kind === 'status'">
        <p
          role="status"
          class="px-2 pt-1 pb-0.5"
          :class="shown.failed ? 'text-problem-error' : 'text-fg-muted'"
        >
          {{ shown.text }}
        </p>
        <button
          v-if="shown.failed"
          type="button"
          class="mx-2 my-1 cursor-pointer rounded border border-control-border px-3.5 py-1 hover:bg-hover"
          @click="retry"
        >
          {{ RETRY }}
        </button>
      </template>
      <template v-for="group in groups" :key="group.kind">
        <p class="px-2 pt-1 pb-0.5 text-fg-muted">{{ group.heading }}</p>
        <ul :aria-label="group.heading">
          <li v-for="line in group.lines" :key="line.reference" class="flex items-start">
            <button
              type="button"
              class="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 rounded px-2 py-1 text-left hover:bg-hover"
              @click="openLink(line.page)"
            >
              <component :is="icons[group.kind]" class="size-4 shrink-0" aria-hidden="true" />
              <span class="shrink-0 font-mono">{{ line.reference }}</span>
              <template v-if="line.detail.kind === 'shown'">
                {{ " " }}<span class="wrap-break-word">{{ line.detail.title }}</span>
                <template v-if="line.detail.closed">
                  {{ " " }}<span class="text-fg-muted">{{ CLOSED }}</span>
                </template>
              </template>
              <template v-else>
                {{ " " }}<span class="text-fg-muted">{{ NOT_SHOWN }}</span>
              </template>
            </button>
            <button
              v-if="line.parent !== null"
              v-tooltip="line.parent.tooltip"
              type="button"
              :aria-label="line.parent.tooltip"
              class="shrink-0 cursor-pointer rounded p-1 hover:bg-hover"
              @click="openLink(line.parent.page)"
            >
              <ArrowUpToLine class="size-4" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </template>
    </div>
  </span>
</template>
