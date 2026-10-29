import type { ShallowRef } from "vue";

import type { ChunkSource, FileEntry, FileMergeData, SideNames } from "../ipc";
import type { Layout, SearchedFile } from "../search";
import { landed, type Stop } from "./currentStop";
import type { WindowKeyTarget } from "./fileListKey";
import { attempt, reportFailure, type EndsStop, type Outcome, type Problem } from "./problem";
import {
  createSearching,
  type SearchPaneInfo,
  type SearchSource,
  type Searching,
} from "./searching";
import { RESULT_HEADER, sideHeader } from "./sideHeaders";
import type { MergePane, ResultLineUp } from "./useMergeController";

export const MERGE_LAYOUT: Layout<MergePane> = {
  panes: ["left", "center", "right"],
  lead: "center",
};

type Live = { lineUp(): ResultLineUp | null };

export type LiveResults = {
  track(path: string, live: Live): void;
  untrack(path: string, live: Live): void;
};

export type MergeSearch = {
  readonly search: Searching<MergePane>;
  readonly liveResults: LiveResults;
};

export type MergeSearchTarget = WindowKeyTarget &
  EndsStop & {
    readonly source: Pick<ChunkSource, "loadFile">;
    readonly files: Readonly<ShallowRef<readonly FileEntry[]>>;
    readonly opened: Readonly<ShallowRef<readonly FileMergeData[]>>;
    readonly sideNames: Readonly<ShallowRef<SideNames>>;
    readonly active: Readonly<ShallowRef<string | null>>;
    readonly problem: ShallowRef<Problem | null>;
    readonly currentStop: () => Readonly<Stop>;
  };

function searchedFile(data: FileMergeData, live: ResultLineUp | null): SearchedFile<MergePane> {
  const { path, middle, deleted } = data;
  const left = deleted === "local" ? null : data.local;
  const right = deleted === "remote" ? null : data.remote;
  if (middle.kind === "DiskNotText") {
    return { path, texts: { left, center: null, right }, changes: [] };
  }
  if (live !== null) {
    return { path, texts: { left, center: live.result, right }, changes: live.changes };
  }
  return {
    path,
    texts: { left, center: middle.text, right },
    changes: data.chunks.map((chunk) => ({
      left: chunk.local,
      center: chunk.middle,
      right: chunk.remote,
    })),
  };
}

export function mergePanes(names: SideNames): readonly SearchPaneInfo<MergePane>[] {
  return [
    { pane: "left", icon: "panel-left", title: sideHeader("local", names).text },
    { pane: "center", icon: "panel-left-right-dashed", title: RESULT_HEADER },
    { pane: "right", icon: "panel-right", title: sideHeader("remote", names).text },
  ];
}

type Kept = { readonly files: Map<string, FileMergeData>; forgets: number };

async function dataOf(
  target: MergeSearchTarget,
  kept: Kept,
  path: string,
): Promise<Outcome<FileMergeData> | null> {
  const known = target.opened.value.find((file) => file.path === path) ?? kept.files.get(path);
  if (known !== undefined) {
    return { ok: true, value: known };
  }
  const before = kept.forgets;
  const loaded = await landed(target.currentStop(), () =>
    attempt(() => target.source.loadFile(path)),
  );
  if (loaded?.ok === true && before === kept.forgets) {
    kept.files.set(path, loaded.value);
  }
  return loaded;
}

function createMergeSource(
  target: MergeSearchTarget,
  live: ReadonlyMap<string, Live>,
): SearchSource<MergePane> {
  const kept: Kept = { files: new Map(), forgets: 0 };

  async function read(path: string): Promise<SearchedFile<MergePane> | null> {
    const data = await dataOf(target, kept, path);
    if (data === null) {
      return null;
    }
    if (!data.ok) {
      await reportFailure(target, { action: "search", cause: data.cause });
      return null;
    }
    return searchedFile(data.value, live.get(path)?.lineUp() ?? null);
  }

  return {
    layout: MERGE_LAYOUT,
    async *files() {
      for (const { path } of target.files.value.filter((entry) => entry.unsupported === null)) {
        const file = await read(path);
        if (file === null) {
          return;
        }
        yield file;
      }
    },
    file: async (path) =>
      target.files.value.some((entry) => entry.path === path && entry.unsupported === null)
        ? read(path)
        : null,
    forget: (path) => {
      kept.files.delete(path);
      kept.forgets += 1;
    },
    forgetAll: () => {
      kept.files.clear();
    },
  };
}

export function createMergeSearch(
  target: MergeSearchTarget,
  open: (path: string) => Promise<void> | void,
): MergeSearch {
  const live = new Map<string, Live>();
  return {
    search: createSearching({
      source: createMergeSource(target, live),
      panes: () => mergePanes(target.sideNames.value),
      open,
      shownPath: () => target.active.value,
      keys: target,
    }),
    liveResults: {
      track: (path, tracked) => {
        live.set(path, tracked);
      },
      untrack: (path, tracked) => {
        if (live.get(path) === tracked) {
          live.delete(path);
        }
      },
    },
  };
}
