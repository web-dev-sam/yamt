import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import {
  dismissFile,
  dismissPlace,
  goToPane,
  listRows,
  summaryOf,
  type Layout,
  type ListRow,
  type PaneHit,
  type Place,
  type PlaceKey,
  type SearchResults,
  type Summary,
} from "../search";
import { windowKey, type KeyPress, type WindowKeyTarget } from "./fileListKey";
import { createSearchRun, type SearchRun, type SearchSource } from "./searchRun";

export type { SearchSource } from "./searchRun";

export type PaneIcon = "panel-left" | "panel-left-right-dashed" | "panel-right";
export type SearchPaneInfo<P extends string> = {
  readonly pane: P;
  readonly icon: PaneIcon;
  readonly title: string;
};
export type GoToRequest<P extends string> = {
  readonly id: number;
  readonly path: string;
  readonly pane: P;
  readonly match: PaneHit | null;
};
export type Searching<P extends string> = {
  readonly shown: Readonly<ShallowRef<boolean>>;
  readonly query: Readonly<ShallowRef<string>>;
  readonly matchCase: Readonly<ShallowRef<boolean>>;
  readonly panesOn: Readonly<ShallowRef<ReadonlySet<P>>>;
  readonly closed: Readonly<ShallowRef<ReadonlySet<string>>>;
  readonly results: Readonly<ShallowRef<SearchResults<P> | null>>;
  readonly running: Readonly<ShallowRef<boolean>>;
  readonly fullRuns: Readonly<ShallowRef<number>>;
  readonly goTo: Readonly<ShallowRef<GoToRequest<P> | null>>;
  readonly panes: ComputedRef<readonly SearchPaneInfo<P>[]>;
  readonly rows: ComputedRef<readonly ListRow<P>[]>;
  readonly summary: ComputedRef<Summary | null>;
  type(text: string): void;
  enter(): void;
  toggleMatchCase(): void;
  togglePane(pane: P): void;
  toggleGroup(path: string): void;
  dismissPlace(path: string, key: PlaceKey): void;
  dismissGroup(path: string): void;
  go(path: string, place: Place<P>, pane: P | null): void;
  took(id: number): void;
  focusShownFile(): void;
  toggleKey(event: KeyPress, platform: string): void;
  changed(path: string): void;
  clear(): void;
  rerun(): void;
};

type SearchingDeps<P extends string> = {
  readonly source: SearchSource<P>;
  readonly panes: () => readonly SearchPaneInfo<P>[];
  readonly open: (path: string) => Promise<void> | void;
  readonly shownPath: () => string | null;
  readonly keys: WindowKeyTarget;
};

type Refs<P extends string> = {
  readonly shown: ShallowRef<boolean>;
  readonly query: ShallowRef<string>;
  readonly matchCase: ShallowRef<boolean>;
  readonly panesOn: ShallowRef<ReadonlySet<P>>;
  readonly closed: ShallowRef<ReadonlySet<string>>;
  readonly results: ShallowRef<SearchResults<P> | null>;
  readonly running: ShallowRef<boolean>;
  readonly fullRuns: ShallowRef<number>;
  readonly goTo: ShallowRef<GoToRequest<P> | null>;
};

type Context<P extends string> = {
  readonly refs: Refs<P>;
  readonly deps: SearchingDeps<P>;
  readonly run: SearchRun<P>;
  readonly goTos: { last: number };
};

function createRefs<P extends string>(layout: Layout<P>): Refs<P> {
  return {
    shown: shallowRef(false),
    query: shallowRef(""),
    matchCase: shallowRef(false),
    panesOn: shallowRef<ReadonlySet<P>>(new Set(layout.panes)),
    closed: shallowRef<ReadonlySet<string>>(new Set()),
    results: shallowRef<SearchResults<P> | null>(null),
    running: shallowRef(false),
    fullRuns: shallowRef(0),
    goTo: shallowRef<GoToRequest<P> | null>(null),
  };
}

function toggled<T>(set: ReadonlySet<T>, item: T): ReadonlySet<T> {
  const next = new Set(set);
  if (!next.delete(item)) {
    next.add(item);
  }
  return next;
}

function requestGoTo<P extends string>(
  { refs, goTos }: Context<P>,
  target: Omit<GoToRequest<P>, "id">,
): number {
  goTos.last += 1;
  refs.goTo.value = { id: goTos.last, ...target };
  return goTos.last;
}

async function go<P extends string>(
  ctx: Context<P>,
  path: string,
  place: Place<P>,
  pane: P | null,
): Promise<void> {
  const { layout } = ctx.deps.source;
  const entry =
    pane === null
      ? goToPane(place, ctx.refs.panesOn.value, layout)
      : (place.hits.find((hit) => hit.pane === pane) ?? null);
  if (entry === null) {
    return;
  }
  const id = requestGoTo(ctx, { path, pane: entry.pane, match: entry.hit });
  await ctx.deps.open(path);
  if (ctx.deps.shownPath() !== path) {
    took(ctx.refs, id);
  }
}

function took<P extends string>(refs: Refs<P>, id: number): void {
  if (refs.goTo.value?.id === id) {
    refs.goTo.value = null;
  }
}

function views<P extends string>({
  refs,
  deps,
}: Context<P>): Pick<Searching<P>, "panes" | "rows" | "summary"> {
  return {
    panes: computed(() => deps.panes()),
    rows: computed(() => {
      const results = refs.results.value;
      return results === null ? [] : listRows(results, refs.panesOn.value, refs.closed.value);
    }),
    summary: computed(() => summaryOf(refs.results.value, refs.panesOn.value, refs.running.value)),
  };
}

function listActions<P extends string>({
  refs,
  run,
}: Context<P>): Pick<Searching<P>, "togglePane" | "toggleGroup" | "dismissPlace" | "dismissGroup"> {
  return {
    togglePane: (pane) => {
      refs.panesOn.value = toggled(refs.panesOn.value, pane);
    },
    toggleGroup: (path) => {
      refs.closed.value = toggled(refs.closed.value, path);
    },
    dismissPlace: (path, key) => {
      run.edit((results) => dismissPlace(results, path, key));
    },
    dismissGroup: (path) => {
      run.edit((results) => dismissFile(results, path));
    },
  };
}

function moving<P extends string>(
  ctx: Context<P>,
): Pick<Searching<P>, "go" | "took" | "focusShownFile" | "toggleKey"> {
  const { refs, deps } = ctx;
  return {
    go: (path, place, pane) => {
      void go(ctx, path, place, pane);
    },
    took: (id) => {
      took(refs, id);
    },
    focusShownFile: () => {
      const path = deps.shownPath();
      if (path !== null) {
        requestGoTo(ctx, { path, pane: deps.source.layout.lead, match: null });
      }
    },
    toggleKey: (event, platform) => {
      if (windowKey(deps.keys, "toggle-search", event, platform)) {
        refs.shown.value = !refs.shown.value;
      }
    },
  };
}

export function createSearching<P extends string>(deps: SearchingDeps<P>): Searching<P> {
  const refs = createRefs(deps.source.layout);
  const run = createSearchRun(refs, deps.source, () => {
    refs.closed.value = new Set();
    refs.fullRuns.value += 1;
  });
  const ctx: Context<P> = { refs, deps, run, goTos: { last: 0 } };
  return {
    ...refs,
    ...views(ctx),
    ...listActions(ctx),
    ...moving(ctx),
    type: (text) => {
      refs.query.value = text;
      run.typed();
    },
    enter: run.rerun,
    toggleMatchCase: () => {
      refs.matchCase.value = !refs.matchCase.value;
      run.rerun();
    },
    changed: run.changed,
    clear: () => {
      run.clear();
      refs.goTo.value = null;
    },
    rerun: run.rerun,
  };
}
