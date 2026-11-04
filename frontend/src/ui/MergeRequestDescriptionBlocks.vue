<script setup lang="ts">
import type { Component } from "vue";
import Square from "~icons/lucide/square";
import SquareCheck from "~icons/lucide/square-check";
import SquareSlash from "~icons/lucide/square-slash";

import type { DescriptionBlock, DescriptionCell, DescriptionItem, DescriptionRow } from "../ipc";
import MergeRequestDescriptionCode from "./MergeRequestDescriptionCode.vue";
import MergeRequestDescriptionInlines from "./MergeRequestDescriptionInlines.vue";
import { TASK_DONE, TASK_INAPPLICABLE, TASK_OPEN } from "./mergeRequestDescriptionText";

type List = Extract<DescriptionBlock, { kind: "list" }>;
type Table = Extract<DescriptionBlock, { kind: "table" }>;
type Task = Exclude<DescriptionItem["task"], "none">;
type TablePart = { readonly tag: "thead" | "tbody"; readonly rows: readonly DescriptionRow[] };

defineProps<{ blocks: readonly DescriptionBlock[] }>();

const TASK_BOXES: Readonly<Record<Task, { readonly icon: Component; readonly word: string }>> = {
  done: { icon: SquareCheck, word: TASK_DONE },
  open: { icon: Square, word: TASK_OPEN },
  inapplicable: { icon: SquareSlash, word: TASK_INAPPLICABLE },
};
const ALIGN_CLASS: Readonly<Record<DescriptionCell["align"], string>> = {
  start: "",
  center: "markdown-align-center",
  end: "markdown-align-right",
};

function listStart(list: List): number | undefined {
  return list.numbering.kind === "numbers" ? list.numbering.start : undefined;
}

function itemNumber(list: List, at: number): string | null {
  return list.numbering.kind === "numbers" ? `${list.numbering.start + at}.` : null;
}

function tableParts(table: Table): readonly TablePart[] {
  const parts: readonly TablePart[] = [
    { tag: "thead", rows: table.head },
    { tag: "tbody", rows: table.body },
  ];
  return parts.filter((part) => part.rows.length > 0);
}
</script>

<template>
  <template v-for="(block, index) in blocks" :key="index">
    <p v-if="block.kind === 'paragraph'" class="markdown-block markdown-paragraph">
      <MergeRequestDescriptionInlines :inlines="block.inlines" />
    </p>
    <component
      :is="block.level"
      v-else-if="block.kind === 'heading'"
      class="markdown-block markdown-heading"
    >
      <MergeRequestDescriptionInlines :inlines="block.inlines" />
    </component>
    <MergeRequestDescriptionCode
      v-else-if="block.kind === 'code'"
      :language="block.language"
      :text="block.text"
    />
    <ul
      v-else-if="block.kind === 'list' && block.numbering.kind === 'bullets'"
      class="markdown-block markdown-list"
    >
      <li
        v-for="(item, at) in block.items"
        :key="at"
        class="markdown-item"
        :class="{ 'list-none': item.task !== 'none' }"
      >
        <component
          :is="TASK_BOXES[item.task].icon"
          v-if="item.task !== 'none'"
          role="img"
          :aria-label="TASK_BOXES[item.task].word"
          class="markdown-number top-0.5 size-4"
        />
        <MergeRequestDescriptionBlocks :blocks="item.blocks" />
      </li>
    </ul>
    <ol
      v-else-if="block.kind === 'list'"
      :start="listStart(block)"
      class="markdown-block markdown-list markdown-ordered"
    >
      <li v-for="(item, at) in block.items" :key="at" class="markdown-item">
        <component
          :is="TASK_BOXES[item.task].icon"
          v-if="item.task !== 'none'"
          role="img"
          :aria-label="TASK_BOXES[item.task].word"
          class="markdown-number top-0.5 size-4"
        />
        <span v-else class="markdown-number">{{ itemNumber(block, at) }}</span>
        <MergeRequestDescriptionBlocks :blocks="item.blocks" />
      </li>
    </ol>
    <blockquote v-else-if="block.kind === 'quote'" class="markdown-block markdown-quote">
      <MergeRequestDescriptionBlocks :blocks="block.blocks" />
    </blockquote>
    <hr v-else-if="block.kind === 'rule'" class="markdown-block markdown-rule" />
    <div v-else-if="block.kind === 'table'" class="markdown-block overflow-x-auto">
      <table class="markdown-table">
        <component :is="part.tag" v-for="part in tableParts(block)" :key="part.tag">
          <tr v-for="(row, at) in part.rows" :key="at">
            <component
              :is="cell.header ? 'th' : 'td'"
              v-for="(cell, column) in row.cells"
              :key="column"
              :class="ALIGN_CLASS[cell.align]"
            >
              <MergeRequestDescriptionInlines :inlines="cell.inlines" />
            </component>
          </tr>
        </component>
      </table>
    </div>
    <details v-else :open="block.open" class="markdown-block">
      <summary class="cursor-pointer">
        <MergeRequestDescriptionInlines :inlines="block.summary" />
      </summary>
      <MergeRequestDescriptionBlocks :blocks="block.blocks" />
    </details>
  </template>
</template>
