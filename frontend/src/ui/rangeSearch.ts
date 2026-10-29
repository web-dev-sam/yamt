import type { ShallowRef } from "vue";

import type { Column, RangeFileId, RangeSource, RangeStart, SearchText } from "../ipc";
import type { Layout, SearchedFile } from "../search";
import type { WindowKeyTarget } from "./fileListKey";
import { attempt, report, type Problem } from "./problem";
import { sideHeading } from "./rangeText";
import {
  createSearching,
  type SearchPaneInfo,
  type SearchSource,
  type Searching,
} from "./searching";

export const RANGE_LAYOUT: Layout<Column> = { panes: ["left", "right"], lead: "right" };

export type RangeSearchTarget = WindowKeyTarget & {
  readonly source: Pick<RangeSource, "searchTexts">;
  readonly start: Readonly<ShallowRef<RangeStart | null>>;
  readonly problem: ShallowRef<Problem | null>;
};

type Paging =
  | { readonly kind: "first" }
  | { readonly kind: "read"; readonly next: RangeFileId | null };

export function rangePanes(start: RangeStart | null): readonly SearchPaneInfo<Column>[] {
  if (start === null) {
    return [];
  }
  return [
    { pane: "left", icon: "panel-left", title: sideHeading(start.left) },
    { pane: "right", icon: "panel-right", title: sideHeading(start.right) },
  ];
}

function keptFiles(texts: readonly SearchText[], start: RangeStart): SearchedFile<Column>[] {
  const paths = new Map(start.files.map(({ id, path }) => [id, path]));
  return texts.flatMap(({ file, left, right, changes }) => {
    const path = paths.get(file);
    return path === undefined ? [] : [{ path, texts: { left, right }, changes }];
  });
}

type Pages = {
  readonly kept: SearchedFile<Column>[];
  paging: Paging;
  loading: Promise<boolean> | null;
};

function pageStart(paging: Paging, start: RangeStart): RangeFileId | null {
  return paging.kind === "first" ? (start.files[0]?.id ?? null) : paging.next;
}

async function readPage(
  target: RangeSearchTarget,
  pages: Pages,
  start: RangeStart,
  from: RangeFileId,
): Promise<boolean> {
  const page = await attempt(() => target.source.searchTexts(from));
  if (!page.ok) {
    report(target, { action: "search", cause: page.cause });
    return false;
  }
  pages.kept.push(...keptFiles(page.value.files, start));
  pages.paging = { kind: "read", next: page.value.next };
  return true;
}

function nextPage(target: RangeSearchTarget, pages: Pages, start: RangeStart): Promise<boolean> {
  const from = pageStart(pages.paging, start);
  if (from === null) {
    return Promise.resolve(false);
  }
  pages.loading ??= readPage(target, pages, start, from).finally(() => {
    pages.loading = null;
  });
  return pages.loading;
}

function createRangeSource(target: RangeSearchTarget): SearchSource<Column> {
  const pages: Pages = { kept: [], paging: { kind: "first" }, loading: null };
  const { kept } = pages;
  return {
    layout: RANGE_LAYOUT,
    async *files() {
      const start = target.start.value;
      if (start === null) {
        return;
      }
      let at = 0;
      while (at < kept.length || (await nextPage(target, pages, start))) {
        const file = kept[at];
        if (file !== undefined) {
          at += 1;
          yield file;
        }
      }
    },
    file: async (path) => kept.find((file) => file.path === path) ?? null,
    forget: () => undefined,
    forgetAll: () => undefined,
  };
}

export function createRangeSearch(
  target: RangeSearchTarget,
  view: { readonly open: (path: string) => void; readonly shownPath: () => string | null },
): Searching<Column> {
  return createSearching({
    source: createRangeSource(target),
    panes: () => rangePanes(target.start.value),
    open: view.open,
    shownPath: view.shownPath,
    keys: target,
  });
}
