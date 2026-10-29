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
  readonly query: Readonly<ShallowRef<string>>;
  readonly matchCase: Readonly<ShallowRef<boolean>>;
  readonly results: ShallowRef<SearchResults<P> | null>;
  readonly running: ShallowRef<boolean>;
};

export type SearchRun<P extends string> = {
  readonly typed: () => void;
  readonly rerun: () => void;
  readonly changed: (path: string) => void;
  readonly edit: (change: (results: SearchResults<P>) => SearchResults<P>) => void;
  readonly clear: () => void;
};

export const SEARCH_PAUSE_MS = 300;
const SLICE_MS = 8;

type Working<P extends string> = {
  readonly matcher: Matcher;
  readonly ranks: Map<string, number>;
  results: SearchResults<P>;
};

type Run<P extends string> = {
  generation: number;
  working: Working<P> | null;
  pause: number | undefined;
  readonly waiting: Map<string, number>;
  readonly tickets: Map<string, number>;
  ticket: number;
};

type Context<P extends string> = {
  readonly refs: RunRefs<P>;
  readonly run: Run<P>;
  readonly source: SearchSource<P>;
  readonly onFullRun: () => void;
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
}

function publish<P extends string>({ refs, run }: Context<P>): void {
  refs.results.value = run.working?.results ?? null;
}

function showNothing<P extends string>(ctx: Context<P>): void {
  cancel(ctx.run);
  ctx.run.working = null;
  publish(ctx);
  ctx.refs.running.value = false;
}

function searched<P extends string>(
  working: Working<P>,
  file: SearchedFile<P> | null,
  { layout, rank, path }: { layout: Layout<P>; rank: number; path: string },
): SearchResults<P> {
  const found =
    file === null
      ? { places: [], cut: false }
      : filePlaces(file, working.matcher, layout, MAX_ROWS);
  return withFile(working.results, { path, rank, ...found });
}

async function readAll<P extends string>(ctx: Context<P>, working: Working<P>): Promise<void> {
  const { run, source } = ctx;
  const { generation } = run;
  let sliceStart = performance.now();
  for await (const file of source.files()) {
    if (generation !== run.generation) {
      return;
    }
    const rank = working.ranks.size;
    working.ranks.set(file.path, rank);
    working.results = searched(working, file, { layout: source.layout, rank, path: file.path });
    if (working.results.cut) {
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
  const working: Working<P> = { matcher, ranks: new Map(), results: emptyResults(query) };
  run.working = working;
  ctx.onFullRun();
  refs.running.value = true;
  await readAll(ctx, working);
  if (generation === run.generation) {
    publish(ctx);
    refs.running.value = false;
  }
}

async function searchAgain<P extends string>(ctx: Context<P>, path: string): Promise<void> {
  const { run, source } = ctx;
  run.waiting.delete(path);
  const { working, generation } = run;
  if (working === null) {
    return;
  }
  const rank = working.ranks.get(path);
  if (rank === undefined) {
    return;
  }
  run.ticket += 1;
  const { ticket } = run;
  run.tickets.set(path, ticket);
  const file = await source.file(path);
  if (generation !== run.generation || run.tickets.get(path) !== ticket) {
    return;
  }
  working.results = searched(working, file, { layout: source.layout, rank, path });
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

function typed<P extends string>(ctx: Context<P>): void {
  const { refs, run } = ctx;
  clearTimeout(run.pause);
  if (refs.query.value === "") {
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
  onFullRun: () => void,
): SearchRun<P> {
  const run: Run<P> = {
    generation: 0,
    working: null,
    pause: undefined,
    waiting: new Map(),
    tickets: new Map(),
    ticket: 0,
  };
  const ctx: Context<P> = { refs, run, source, onFullRun };
  return {
    typed: () => {
      typed(ctx);
    },
    rerun: () => {
      void fullRun(ctx);
    },
    changed: (path) => {
      changed(ctx, path);
    },
    edit: (change) => {
      if (run.working !== null) {
        run.working.results = change(run.working.results);
        publish(ctx);
      }
    },
    clear: () => {
      showNothing(ctx);
      source.forgetAll();
    },
  };
}
