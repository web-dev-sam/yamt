import type { ShallowRef } from "vue";

import {
  emptyResults,
  filePlaces,
  matcherOf,
  MAX_ROWS,
  withFile,
  type Layout,
  type Matcher,
  type SearchedFile,
  type SearchResults,
} from "../search";

export type SearchSource<P extends string> = {
  readonly layout: Layout<P>;
  files(): AsyncIterable<SearchedFile<P>>;
  file(path: string): Promise<SearchedFile<P> | null>;
  forget(path: string): void;
  forgetAll(): void;
};

export type RunRefs<P extends string> = {
  readonly query: ShallowRef<string>;
  readonly matchCase: ShallowRef<boolean>;
  readonly closed: ShallowRef<ReadonlySet<string>>;
  readonly results: ShallowRef<SearchResults<P> | null>;
  readonly running: ShallowRef<boolean>;
};

export type SearchRun<P extends string> = {
  readonly type: (text: string) => void;
  readonly rerun: () => void;
  readonly changed: (path: string) => void;
  readonly edit: (change: (results: SearchResults<P>) => SearchResults<P>) => void;
  readonly clear: () => void;
};

export const SEARCH_PAUSE_MS = 300;
const SLICE_MS = 8;

type Run<P extends string> = {
  generation: number;
  working: SearchResults<P> | null;
  readonly ranks: Map<string, number>;
  pause: number | undefined;
  readonly waiting: Map<string, number>;
  readonly tickets: Map<string, number>;
  ticket: number;
};

type Context<P extends string> = {
  readonly refs: RunRefs<P>;
  readonly run: Run<P>;
  readonly source: SearchSource<P>;
};

function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function cancel(run: Run<string>): void {
  run.generation += 1;
  clearTimeout(run.pause);
  for (const timer of run.waiting.values()) {
    clearTimeout(timer);
  }
  run.waiting.clear();
  run.tickets.clear();
}

function publish<P extends string>({ refs, run }: Context<P>): void {
  refs.results.value = run.working;
}

function showNothing<P extends string>(ctx: Context<P>): void {
  cancel(ctx.run);
  ctx.run.working = null;
  ctx.run.ranks.clear();
  publish(ctx);
  ctx.refs.running.value = false;
}

function searched<P extends string>(
  results: SearchResults<P>,
  file: SearchedFile<P> | null,
  {
    matcher,
    layout,
    rank,
    path,
  }: { matcher: Matcher; layout: Layout<P>; rank: number; path: string },
): SearchResults<P> {
  const found =
    file === null ? { places: [], cut: false } : filePlaces(file, matcher, layout, MAX_ROWS);
  return withFile(results, { path, rank, ...found });
}

async function readAll<P extends string>(ctx: Context<P>, matcher: Matcher): Promise<void> {
  const { run, source } = ctx;
  const { generation } = run;
  let sliceStart = performance.now();
  for await (const file of source.files()) {
    if (generation !== run.generation || run.working === null) {
      return;
    }
    const rank = run.ranks.size;
    run.ranks.set(file.path, rank);
    const { layout } = source;
    run.working = searched(run.working, file, { matcher, layout, rank, path: file.path });
    if (run.working.cut) {
      return;
    }
    if (performance.now() - sliceStart >= SLICE_MS) {
      publish(ctx);
      await nextTask();
      if (generation !== run.generation) {
        return;
      }
      sliceStart = performance.now();
    }
  }
}

async function fullRun<P extends string>(ctx: Context<P>): Promise<void> {
  const { refs, run } = ctx;
  const query = { text: refs.query.value, matchCase: refs.matchCase.value };
  const matcher = matcherOf(query);
  if (matcher === null) {
    return;
  }
  cancel(run);
  const { generation } = run;
  run.working = emptyResults(query);
  run.ranks.clear();
  refs.closed.value = new Set();
  refs.running.value = true;
  await readAll(ctx, matcher);
  if (generation === run.generation) {
    publish(ctx);
    refs.running.value = false;
  }
}

async function searchAgain<P extends string>(ctx: Context<P>, path: string): Promise<void> {
  const { run, source } = ctx;
  run.waiting.delete(path);
  const rank = run.ranks.get(path);
  const matcher = run.working === null ? null : matcherOf(run.working.query);
  if (matcher === null || rank === undefined) {
    return;
  }
  const { generation } = run;
  run.ticket += 1;
  const { ticket } = run;
  run.tickets.set(path, ticket);
  const file = await source.file(path);
  if (generation !== run.generation || run.tickets.get(path) !== ticket || run.working === null) {
    return;
  }
  run.tickets.delete(path);
  run.working = searched(run.working, file, { matcher, layout: source.layout, rank, path });
  publish(ctx);
}

function changed<P extends string>(ctx: Context<P>, path: string): void {
  const { run } = ctx;
  ctx.source.forget(path);
  clearTimeout(run.waiting.get(path));
  run.waiting.set(
    path,
    setTimeout(() => {
      void searchAgain(ctx, path);
    }, SEARCH_PAUSE_MS),
  );
}

function typed<P extends string>(ctx: Context<P>, text: string): void {
  const { refs, run } = ctx;
  refs.query.value = text;
  clearTimeout(run.pause);
  if (text === "") {
    showNothing(ctx);
    return;
  }
  run.pause = setTimeout(() => {
    run.pause = undefined;
    void fullRun(ctx);
  }, SEARCH_PAUSE_MS);
}

export function createSearchRun<P extends string>(
  refs: RunRefs<P>,
  source: SearchSource<P>,
): SearchRun<P> {
  const run: Run<P> = {
    generation: 0,
    working: null,
    ranks: new Map(),
    pause: undefined,
    waiting: new Map(),
    tickets: new Map(),
    ticket: 0,
  };
  const ctx: Context<P> = { refs, run, source };
  return {
    type: (text) => {
      typed(ctx, text);
    },
    rerun: () => {
      void fullRun(ctx);
    },
    changed: (path) => {
      changed(ctx, path);
    },
    edit: (change) => {
      if (run.working !== null) {
        run.working = change(run.working);
        publish(ctx);
      }
    },
    clear: () => {
      showNothing(ctx);
      source.forgetAll();
    },
  };
}
