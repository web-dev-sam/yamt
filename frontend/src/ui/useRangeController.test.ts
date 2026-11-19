import { expect, test, vi } from "vitest";
import { effectScope, nextTick, shallowRef, type ShallowRef } from "vue";

import type { Preferences, RangeEvents, RangeTexts, ShownThread } from "../editor";
import {
  changedThreadLine,
  createFixtureRangeSource,
  diffLineOf,
  log,
  onePlace,
  type RangeEntry,
  type RangeFile,
  type RangeSource,
  type RangeStart,
} from "../ipc";
import type { Problem } from "./problem";
import { createRangeReviewed } from "./rangeReviewed";
import { SINCE_NO_TEXT } from "./rangeText";
import { createRangeThreads } from "./rangeThreads";
import { preferencesOf, startSettings } from "./settings";
import {
  followRange,
  rangeThreadParts,
  shownHosts,
  sinceShown,
  takesSearchMove,
  viewKind,
  viewParts,
  wholeShown,
  type RangeHandle,
  type RangeParts,
  type RangeShown,
  type ShownRange,
} from "./useRangeController";

type Built = {
  readonly texts: RangeTexts;
  readonly hosts: string;
  readonly theme: string;
  readonly collapsed: boolean;
  readonly threads: readonly string[];
};

type Run = {
  readonly handle: RangeHandle;
  readonly built: Built[];
  readonly calls: string[];
  readonly hosts: ShallowRef<string | null>;
  readonly preferences: ShallowRef<Preferences>;
  readonly collapsed: ShallowRef<boolean>;
  readonly threads: ShallowRef<readonly ShownThread[]>;
  readonly listed: ShallowRef<boolean>;
  readonly events: () => RangeEvents;
  readonly answer: (file: RangeFile | null) => Promise<void>;
  readonly stop: () => void;
};

type RunFrom = {
  readonly hosts?: string | null;
  readonly listed?: boolean;
  readonly collapsed?: ShallowRef<boolean>;
};

const DARK = preferencesOf(startSettings("dark"));
const LIGHT = preferencesOf(startSettings("light"));
const TEXTS: RangeFile = {
  kind: "texts",
  left: "a\n",
  right: "b\n",
  differences: [],
  mode: { kind: "changed", old: "file", new: "executable" },
};
const THREAD: ShownThread = {
  key: "thread-1",
  place: onePlace(changedThreadLine("left", 2)),
  shown: "open",
};
const IDLE: ShownRange = {
  setPreferences: () => {},
  setCollapsed: () => {},
  moveToChange: () => {},
  goTo: () => {},
  showThreads: () => {},
  destroy: () => {},
};

function keysOf(threads: readonly ShownThread[]): string[] {
  return threads.map(({ key }) => key);
}

function run(from: RunFrom = {}): Run {
  const built: Built[] = [];
  const calls: string[] = [];
  const hosts = shallowRef<string | null>(from.hosts === undefined ? "hosts" : from.hosts);
  const preferences = shallowRef(DARK);
  const collapsed = from.collapsed ?? shallowRef(true);
  const threads = shallowRef<readonly ShownThread[]>([]);
  const listed = shallowRef(from.listed ?? true);
  const given: RangeEvents[] = [];
  const answers: ((shown: RangeShown | null) => void)[] = [];
  const loaded = new Promise<RangeShown | null>((resolve) => {
    answers.push(resolve);
  });
  const scope = effectScope();
  const shown: ShownRange = {
    setPreferences: (next) => calls.push(`preferences ${next.theme}`),
    setCollapsed: (on) => calls.push(`collapsed ${on}`),
    moveToChange: (direction) => calls.push(`move ${direction}`),
    goTo: ({ pane, match }) =>
      calls.push(`goTo ${pane} ${match === null ? "keyboard" : match.line}`),
    showThreads: (next) => calls.push(`threads ${keysOf(next).join(",")}`),
    destroy: () => calls.push("destroy"),
  };
  const handle = scope.run(() =>
    followRange({
      path: "src/board.ts",
      load: () => loaded,
      hosts: () => hosts.value,
      preferences,
      collapsed,
      threads: () => threads.value,
      listed: () => listed.value,
      events: {
        startThread: (place) => calls.push(`start ${place.end.kind}`),
        toggleThreads: (keys) => calls.push(`toggle ${keys.join(",")}`),
      },
      startsThreads: true,
      build: (texts, at, options, events) => {
        const { preferences: chosen, collapsed: on } = options;
        const threadKeys = keysOf(options.threads);
        built.push({ texts, hosts: at, theme: chosen.theme, collapsed: on, threads: threadKeys });
        given.push(events);
        return shown;
      },
    }),
  );
  if (handle === undefined) {
    throw new Error("the scope did not run");
  }
  return {
    handle,
    built,
    calls,
    hosts,
    preferences,
    collapsed,
    threads,
    listed,
    events: () => {
      const [events] = given;
      if (events === undefined) {
        throw new Error("nothing built");
      }
      return events;
    },
    answer: async (file) => {
      for (const answer of answers) {
        answer(file === null ? null : wholeShown(file));
      }
      await loaded;
      await nextTick();
    },
    stop: () => {
      scope.stop();
    },
  };
}

test("a texts reply builds one controller on the hosts with the path, both texts and the preferences", async () => {
  const live = run();
  expect(live.handle.content.value).toEqual({ kind: "loading" });

  await live.answer(TEXTS);

  expect(live.handle.content.value).toEqual({
    kind: "columns",
    note: "Mode changed: file → executable file",
  });
  expect(live.built).toEqual([
    {
      texts: { path: "src/board.ts", left: "a\n", right: "b\n", differences: [] },
      hosts: "hosts",
      theme: "dark",
      collapsed: true,
      threads: [],
    },
  ]);
});

test("the controller waits for its hosts, then follows preferences and arrows, and is destroyed with the view", async () => {
  const live = run({ hosts: null });
  live.handle.moveToChange("down");
  await live.answer(TEXTS);
  expect(live.built).toEqual([]);

  live.hosts.value = "mounted";
  await nextTick();
  expect(live.built.map(({ hosts }) => hosts)).toEqual(["mounted"]);

  live.hosts.value = "again";
  await nextTick();
  expect(live.built).toHaveLength(1);

  live.preferences.value = LIGHT;
  await nextTick();
  live.handle.moveToChange("up");
  live.stop();
  live.handle.moveToChange("down");

  expect(live.calls).toEqual(["preferences light", "move up", "destroy"]);
});

test("the controller is built with the file's threads at that moment, and shown each later change of them", async () => {
  const live = run({ hosts: null });
  live.threads.value = [THREAD];
  await nextTick();
  expect(live.calls).toEqual([]);

  await live.answer(TEXTS);
  live.hosts.value = "mounted";
  await nextTick();
  expect(live.built.map(({ threads }) => threads)).toEqual([["thread-1"]]);
  expect(live.calls).toEqual([]);

  live.threads.value = [THREAD, { ...THREAD, key: "draft-0", shown: "draft" }];
  await nextTick();
  expect(live.calls).toEqual(["threads thread-1,draft-0"]);
});

test("a thread change calls showThreads and never setCollapsed (catches runs recomputed on an add)", async () => {
  const live = run();
  await live.answer(TEXTS);

  live.threads.value = [THREAD];
  await nextTick();
  live.threads.value = [];
  await nextTick();

  expect(live.calls).toEqual(["threads thread-1", "threads "]);
});

test("the controller is built with the store's collapsing at that moment", async () => {
  const live = run({ hosts: null });
  live.collapsed.value = false;
  await nextTick();

  await live.answer(TEXTS);
  live.hosts.value = "mounted";
  await nextTick();

  expect(live.built.map(({ collapsed }) => collapsed)).toEqual([false]);
  expect(live.calls).toEqual([]);
});

test("a toggle reaches every live controller through setCollapsed with no rebuild; a file opened after it builds with the new state", async () => {
  const collapsed = shallowRef(true);
  const first = run({ collapsed });
  const second = run({ collapsed });
  await first.answer(TEXTS);
  await second.answer(TEXTS);

  collapsed.value = false;
  await nextTick();
  const later = run({ collapsed });
  await later.answer(TEXTS);
  collapsed.value = true;
  await nextTick();

  expect([first, second].map(({ built, calls }) => [built.length, calls])).toEqual([
    [1, ["collapsed false", "collapsed true"]],
    [1, ["collapsed false", "collapsed true"]],
  ]);
  expect(later.built.map(({ collapsed: on }) => on)).toEqual([false]);
  expect(later.calls).toEqual(["collapsed true"]);
});

test("nothing builds before the thread list was read once; then it builds with the threads read", async () => {
  const live = run({ listed: false });
  await live.answer(TEXTS);
  live.threads.value = [THREAD];
  await nextTick();
  expect(live.built).toEqual([]);

  live.listed.value = true;
  await nextTick();

  expect(live.built.map(({ threads }) => threads)).toEqual([["thread-1"]]);
  expect(live.calls).toEqual([]);
});

test("a thread change after the view unmounted reaches no controller (catches a destroyed controller shown again)", async () => {
  const live = run();
  await live.answer(TEXTS);
  live.stop();

  live.threads.value = [THREAD];
  live.collapsed.value = false;
  await nextTick();

  expect(live.calls).toEqual(["destroy"]);
});

test("the controller gets the line events and its hosts reach threadHosts", async () => {
  const live = run();
  await live.answer(TEXTS);
  const events = live.events();
  const hosts = new Map<string, HTMLElement>();

  events.startThread(onePlace(changedThreadLine("right", 4)));
  events.toggleThreads(["thread-1", "thread-2"]);
  events.hosts(hosts);

  expect(live.calls).toEqual(["start added", "toggle thread-1,thread-2"]);
  expect(live.handle.threadHosts.value).toBe(hosts);
});

test("a go-to waits for the load, the hosts and the thread list, is applied once at build, then goes straight to the controller", async () => {
  const live = run({ hosts: null, listed: false });
  live.handle.goTo({ pane: "left", match: { line: 1, from: 0, to: 1 } });
  live.handle.goTo({ pane: "right", match: { line: 3, from: 0, to: 1 } });

  await live.answer(TEXTS);
  live.hosts.value = "mounted";
  await nextTick();
  expect(live.built).toEqual([]);
  expect(live.calls).toEqual([]);

  live.listed.value = true;
  await nextTick();
  expect(live.built).toHaveLength(1);
  expect(live.calls).toEqual(["goTo right 3"]);

  live.hosts.value = "again";
  await nextTick();
  live.handle.goTo({ pane: "left", match: null });
  expect(live.calls).toEqual(["goTo right 3", "goTo left keyboard"]);
});

test("a go-to after the view unmounted reaches no controller", async () => {
  const live = run();
  await live.answer(TEXTS);
  live.stop();

  live.handle.goTo({ pane: "right", match: { line: 0, from: 0, to: 1 } });

  expect(live.calls).toEqual(["destroy"]);
});

test.each<RangeFile>([
  { kind: "binary" },
  { kind: "tooLarge", limit: 8_388_608 },
  { kind: "notUtf8", sides: "both" },
  { kind: "modeOnly", old: "file", new: "executable" },
  { kind: "kindChanged", old: "file", new: "link" },
  { kind: "submodule", old: null, new: "abc" },
])("a $kind reply builds no controller and shows its sentence", async (file) => {
  const live = run();

  await live.answer(file);

  expect(live.built).toEqual([]);
  expect(live.handle.content.value.kind).toBe("sentence");
});

test("the binary sentence is the one rangeText words", async () => {
  const live = run();

  await live.answer({ kind: "binary" });

  expect(live.handle.content.value).toEqual({ kind: "sentence", text: "Binary file: not shown." });
});

test("a go-to on a sentence asks for the sentence's focus each time; one waiting for the load asks once the sentence lands", async () => {
  const waiting = run();
  waiting.handle.goTo({ pane: "right", match: null });
  expect(waiting.handle.sentenceFocusAsks.value).toBe(0);

  await waiting.answer({ kind: "binary" });
  expect(waiting.handle.sentenceFocusAsks.value).toBe(1);
  waiting.handle.goTo({ pane: "left", match: { line: 0, from: 0, to: 1 } });
  waiting.handle.goTo({ pane: "right", match: null });
  expect([waiting.handle.sentenceFocusAsks.value, waiting.built, waiting.calls]).toEqual([
    3,
    [],
    [],
  ]);

  const unasked = run();
  await unasked.answer({ kind: "binary" });
  expect(unasked.handle.sentenceFocusAsks.value).toBe(0);
});

test("a go-to on texts never asks for a sentence's focus", async () => {
  const live = run();
  live.handle.goTo({ pane: "right", match: null });
  await live.answer(TEXTS);
  live.handle.goTo({ pane: "left", match: null });

  expect([live.handle.sentenceFocusAsks.value, live.calls]).toEqual([
    0,
    ["goTo right keyboard", "goTo left keyboard"],
  ]);
});

test("a reply arriving after unmount is dropped: nothing built, nothing shown", async () => {
  const live = run();
  live.stop();

  await live.answer(TEXTS);

  expect(live.built).toEqual([]);
  expect(live.handle.content.value).toEqual({ kind: "loading" });
  expect(live.calls).toEqual([]);
});

test("a failed load builds nothing and stays loading", async () => {
  const live = run();

  await live.answer(null);

  expect(live.built).toEqual([]);
  expect(live.handle.content.value).toEqual({ kind: "loading" });
});

test("preferences changed before the controller exists reach it at build, not through a missing controller", async () => {
  const live = run({ hosts: null });
  live.preferences.value = LIGHT;
  await nextTick();

  await live.answer(TEXTS);
  live.hosts.value = "mounted";
  await nextTick();

  expect(live.built.map(({ theme }) => theme)).toEqual(["light"]);
  expect(live.calls).toEqual([]);
});

test.each(["left", "right", "strip"] as const)(
  "no hosts while the %s ref is still null (catches a column built on a half-mounted view)",
  (missing) => {
    const refs = {
      left: shallowRef<string | null>("left host"),
      right: shallowRef<string | null>("right host"),
      strip: shallowRef<number | null>(0),
    };
    expect(shownHosts(refs)).toEqual({ left: "left host", right: "right host", strip: 0 });

    refs[missing].value = null;

    expect(shownHosts(refs)).toBeNull();
  },
);

test("startThread(place) starts a draft with that place in that file only; toggle opens and closes", async () => {
  const fixture = createFixtureRangeSource(log, "?range=review&threads=seeded");
  const start = await fixture.openRange();
  if (!start.ok) {
    throw new Error("the fixture did not open");
  }
  const { files } = start.value;
  const first = files.find(({ path }) => path === "src/board/board.ts");
  const second = files.find(({ path }) => path === "config");
  if (first === undefined || second === undefined) {
    throw new Error("the fixture lost board.ts or config");
  }
  const threads = createRangeThreads(fixture, () => undefined);
  await threads.load();
  const before = threads.shownFor(second.id);
  const parts = rangeThreadParts(threads, first);
  const place = {
    start: diffLineOf(changedThreadLine("left", 0)),
    end: changedThreadLine("right", 1),
  };

  parts.events.startThread(place);

  const draft = { key: "draft-0", place, shown: "draft" };
  expect(parts.threads()).toContainEqual(draft);
  expect(threads.shownFor(first.id)).toContainEqual(draft);
  expect(threads.shownFor(second.id)).toEqual(before);

  const stored = threads.list.value.threads.find(({ file }) => file === first.id);
  if (stored === undefined) {
    throw new Error("the seeded fixture has no thread on the first file");
  }
  const key = `thread-${stored.id}`;
  parts.events.toggleThreads([key]);
  expect(threads.open.value.has(stored.id)).toBe(true);
  parts.events.toggleThreads([key]);
  expect(threads.open.value.has(stored.id)).toBe(false);
});

test.each([
  ["read", (fixture: RangeSource): RangeSource => fixture, [6]],
  [
    "failed",
    (fixture: RangeSource): RangeSource => ({
      ...fixture,
      listThreads: async () => ({ ok: false, failure: { kind: "WorkerStopped" } }),
    }),
    [0],
  ],
] as const)(
  "a file waits for the thread list, then builds once it was %s (catches columns stuck empty)",
  async (_name, source, expected) => {
    const fixture = createFixtureRangeSource(log, "?range=review&threads=seeded");
    const start = await fixture.openRange();
    const board = start.ok
      ? start.value.files.find(({ path }) => path === "src/board/board.ts")
      : undefined;
    if (board === undefined) {
      throw new Error("the fixture lost board.ts");
    }
    const threads = createRangeThreads(source(fixture), () => undefined);
    const built: number[] = [];
    const scope = effectScope();
    scope.run(() =>
      followRange({
        path: board.path,
        load: async () => wholeShown(TEXTS),
        hosts: () => "hosts",
        preferences: DARK,
        collapsed: true,
        ...rangeThreadParts(threads, board),
        startsThreads: true,
        build: (_texts, _hosts, options) => {
          built.push(options.threads.length);
          return IDLE;
        },
      }),
    );
    await nextTick();
    const beforeList = [...built];

    await threads.load();
    await nextTick();
    scope.stop();

    expect(beforeList).toEqual([]);
    expect(built).toEqual(expected);
  },
);

type ViewWindow = {
  readonly store: Parameters<typeof viewParts>[0];
  readonly source: RangeSource;
  readonly loads: string[];
  readonly problems: Problem[];
  readonly entry: (path: string) => RangeEntry;
};

type Followed = {
  readonly handle: RangeHandle;
  readonly texts: RangeTexts[];
  readonly startsThreads: boolean[];
  readonly threads: string[][];
};

async function viewWindow(search: string, edit: Partial<RangeSource> = {}): Promise<ViewWindow> {
  const source = { ...createFixtureRangeSource(log, search), ...edit };
  const opened = await source.openRange();
  if (!opened.ok) {
    throw new Error("the fixture did not open");
  }
  const start = shallowRef<RangeStart | null>(opened.value);
  const loads: string[] = [];
  const problems: Problem[] = [];
  function report(problem: Problem): void {
    problems.push(problem);
  }
  const store = {
    loadFile: async (entry: RangeEntry): Promise<RangeFile | null> => {
      loads.push(entry.path);
      const loaded = await source.loadRangeFile(entry.id);
      return loaded.ok ? loaded.value : null;
    },
    threads: createRangeThreads(source, report),
    reviewed: createRangeReviewed(source, {
      start,
      show: () => {},
      problems: report,
      loadView: async (_view, call, problem) => {
        const result = await call();
        if (result.ok) {
          return result.value;
        }
        report(problem(result.failure));
        return null;
      },
    }),
  };
  function entry(path: string): RangeEntry {
    const found = opened.ok ? opened.value.files.find((each) => each.path === path) : undefined;
    if (found === undefined) {
      throw new Error(`no file ${path}`);
    }
    return found;
  }
  return { store, source, loads, problems, entry };
}

async function followed(
  path: string,
  parts: Pick<RangeParts<string>, "load" | "threads" | "listed" | "events" | "startsThreads">,
): Promise<Followed> {
  const texts: RangeTexts[] = [];
  const startsThreads: boolean[] = [];
  const threads: string[][] = [];
  const handle = effectScope().run(() =>
    followRange({
      path,
      hosts: () => "hosts",
      preferences: DARK,
      collapsed: true,
      ...parts,
      build: (built, _hosts, options) => {
        texts.push(built);
        startsThreads.push(options.startsThreads);
        threads.push(keysOf(options.threads));
        return IDLE;
      },
    }),
  );
  if (handle === undefined) {
    throw new Error("the scope did not run");
  }
  await vi.waitFor(() => {
    expect(handle.content.value.kind).not.toBe("loading");
  });
  await nextTick();
  return { handle, texts, startsThreads, threads };
}

const SINCE_SEEDED = "?range=review&reviewed=seeded&threads=seeded";
const BOARD = "src/board/board.ts";

test("a_since_review_view_loads_load_since_review_and_shows_reviewed_left_current_right", async () => {
  const window = await viewWindow(SINCE_SEEDED);
  const board = window.entry(BOARD);
  const since = await window.source.loadSinceReview(board.id);
  if (!since.ok || since.value.kind !== "texts") {
    throw new Error("the fixture's board.ts has no since texts");
  }

  const view = await followed(board.path, viewParts(window.store, board, "sinceReview"));

  expect(view.handle.content.value).toEqual({ kind: "columns", note: null });
  expect(view.texts).toEqual([
    {
      path: BOARD,
      left: since.value.reviewed,
      right: since.value.current,
      differences: since.value.differences,
    },
  ]);
  expect(since.value.reviewed).not.toBe(since.value.current);
  expect(window.loads).toEqual([]);
});

test("a_since_review_view_shows_no_threads_and_builds_with_starts_threads_false", async () => {
  const window = await viewWindow(SINCE_SEEDED);
  const board = window.entry(BOARD);
  const since = viewParts(window.store, board, "sinceReview");

  const view = await followed(board.path, since);
  await window.store.threads.load();
  const whole = viewParts(window.store, board, "whole");

  expect([view.texts.length, view.startsThreads, view.threads]).toEqual([1, [false], [[]]]);
  expect(whole.threads().length).toBeGreaterThan(0);
  expect([since.threads(), since.listed(), whole.startsThreads]).toEqual([[], true, true]);
});

test("a_no_text_since_reply_is_the_since_sentence", async () => {
  const window = await viewWindow(SINCE_SEEDED);
  const logo = window.entry("public/logo.png");

  const view = await followed(logo.path, viewParts(window.store, logo, "sinceReview"));

  expect(view.handle.content.value).toEqual({ kind: "sentence", text: SINCE_NO_TEXT });
  expect(view.texts).toEqual([]);
  expect(sinceShown({ kind: "noText" })).toEqual({ kind: "sentence", text: SINCE_NO_TEXT });
  expect(
    sinceShown({ kind: "texts", reviewed: "old\n", current: "new\n", differences: [] }),
  ).toEqual({ kind: "texts", left: "old\n", right: "new\n", differences: [], note: null });
});

test("a failed since load answers null and reports it; a failed whole load answers null", async () => {
  const window = await viewWindow(SINCE_SEEDED, {
    loadSinceReview: async () => ({ ok: false, failure: { kind: "WorkerStopped" } }),
    loadRangeFile: async () => ({ ok: false, failure: { kind: "WorkerStopped" } }),
  });
  const board = window.entry(BOARD);

  const since = await viewParts(window.store, board, "sinceReview").load();
  const whole = await viewParts(window.store, board, "whole").load();

  expect([since, whole]).toEqual([null, null]);
  expect(window.problems.map((problem) => problem.action)).toEqual(["reviewed"]);
});

test("the_whole_view_is_unchanged", async () => {
  const window = await viewWindow(SINCE_SEEDED);
  const board = window.entry(BOARD);
  const loaded = await window.source.loadRangeFile(board.id);
  if (!loaded.ok || loaded.value.kind !== "texts") {
    throw new Error("the fixture's board.ts has no texts");
  }
  const { left, right, differences } = loaded.value;
  await window.store.threads.load();
  const parts = viewParts(window.store, board, "whole");
  const threadParts = rangeThreadParts(window.store.threads, board);

  const view = await followed(board.path, parts);

  expect(window.loads).toEqual([BOARD]);
  expect(view.handle.content.value).toEqual({ kind: "columns", note: null });
  expect(view.texts).toEqual([{ path: BOARD, left, right, differences }]);
  expect(view.startsThreads).toEqual([true]);
  expect(view.threads).toEqual([keysOf(threadParts.threads())]);
  expect(view.threads[0]?.length).toBeGreaterThan(0);
});

test("a texts file shows both texts with its mode note; any other file its sentence", () => {
  expect(wholeShown(TEXTS)).toEqual({
    kind: "texts",
    left: "a\n",
    right: "b\n",
    differences: [],
    note: "Mode changed: file → executable file",
  });
  expect(wholeShown({ kind: "binary" })).toEqual({
    kind: "sentence",
    text: "Binary file: not shown.",
  });
});

test("only a changed-since-review mark opens the since view", () => {
  expect([viewKind(undefined), viewKind("reviewed"), viewKind("changedSinceReview")]).toEqual([
    "whole",
    "whole",
    "sinceReview",
  ]);
});

test("a search hit in the since view moves only on the right; the whole view takes both panes", () => {
  expect([
    takesSearchMove("sinceReview", "left"),
    takesSearchMove("sinceReview", "right"),
    takesSearchMove("whole", "left"),
    takesSearchMove("whole", "right"),
  ]).toEqual([false, true, true, true]);
});
