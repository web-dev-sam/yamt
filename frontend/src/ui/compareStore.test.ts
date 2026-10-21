import { afterEach, expect, test, vi } from "vitest";

import {
  createFixtureCompareSource,
  log,
  nextColumnVersion,
  type Comparison,
  type CompareSource,
  type SourceFailure,
  type SourceResult,
  type TabId,
} from "../ipc";
import {
  createCompareStore,
  useCompareStore,
  type ColumnFormatFailure,
  type ColumnSend,
  type CompareStore,
  type TrackedTab,
} from "./compareStore";
import type { KeyPress } from "./fileListKey";
import { problemText } from "./problemText";
import { useSettingsStore } from "./settingsStore";

type Gate = { readonly opened: Promise<null>; readonly open: () => void };

type Edit = (fixture: CompareSource) => Partial<CompareSource>;

type Handle = TrackedTab & { readonly asked: string[] };

type Act = (store: CompareStore, tab: TabId) => Promise<void>;

const LINUX = "Linux x86_64";
const LIMIT = 8 * 1024 * 1024;
const GONE: SourceFailure = { kind: "ReadFailed", path: "/data/tabs.json", message: "denied" };
const UNKNOWN: SourceFailure = { kind: "UnknownTab", tab: 4 };
const MICROTASKS = 10;

afterEach(() => {
  vi.restoreAllMocks();
});

function spyConsole(): { info: string[]; error: string[] } {
  const lines = { info: new Array<string>(), error: new Array<string>() };
  vi.spyOn(console, "info").mockImplementation((line: string) => {
    lines.info.push(line);
  });
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    lines.error.push(line);
  });
  return lines;
}

function gate(): Gate {
  const opens: ((value: null) => void)[] = [];
  const opened = new Promise<null>((resolve) => {
    opens.push(resolve);
  });
  return {
    opened,
    open: () => {
      for (const open of opens) {
        open(null);
      }
    },
  };
}

function failed(failure: SourceFailure): Promise<SourceResult<never>> {
  return Promise.resolve({ ok: false, failure });
}

function compareSource(): CompareSource {
  return createFixtureCompareSource(log, "", {});
}

async function started(edit: Edit = () => ({})): Promise<CompareStore> {
  const fixture = compareSource();
  const store = createCompareStore({ ...fixture, ...edit(fixture) }, "dark");
  await store.startUp();
  return store;
}

function tabAt(store: CompareStore, index: number): TabId {
  const entry = store.tabs.value[index];
  if (entry === undefined) {
    throw new Error(`no tab at ${index}`);
  }
  return entry.id;
}

async function sendOf(store: CompareStore, tab: TabId, text: string): Promise<ColumnSend> {
  const loaded = await store.loadTab(tab);
  if (loaded === null) {
    throw new Error("the tab did not load");
  }
  return { column: "left", text, version: nextColumnVersion(loaded.comparison.versions.left) };
}

async function holdingText(store: CompareStore, tab: TabId): Promise<void> {
  spyConsole();
  await store.saveColumn(tab, await sendOf(store, tab, "kept"));
  await store.showTab(tab);
}

function handle(holdsText: boolean, unsent: readonly ColumnSend[] = []): Handle {
  const asked: string[] = [];
  return {
    asked,
    unsent: () => {
      asked.push("unsent");
      return unsent;
    },
    holdsText: () => {
      asked.push("holdsText");
      return holdsText;
    },
  };
}

test("the window's components get no store before the root creates one (catches a store read before main.ts made it)", () => {
  expect(() => useCompareStore()).toThrow("useCompareStore() called before createCompareStore()");
});

test("start-up lists the stored tabs, sets the column limit and loads the settings (catches a limit or list left unset)", async () => {
  const fixture = compareSource();
  const store = createCompareStore(fixture, "dark");

  expect([store.tabs.value, store.shown.value, store.columnLimit.value]).toEqual([[], null, 0]);
  expect([store.fileListShown.value, store.screen.value]).toEqual([true, { kind: "files" }]);

  await store.startUp();

  expect(store.tabs.value).toEqual([
    { id: store.shown.value, name: "Compare 1", language: { kind: "auto" }, holdsText: false },
  ]);
  expect(store.columnLimit.value).toBe(LIMIT);
  expect(store.settings.value.read?.path).toBe("/fixture/settings.json");
  expect([store.problem.value, store.notices.value, store.detected.value]).toEqual([
    null,
    [],
    new Map(),
  ]);
  expect(useCompareStore()).toBe(store);
  expect(useSettingsStore()).toBe(store);
});

test("a failed start shows the problem and lists nothing (catches a failure read as an empty list)", async () => {
  const lines = spyConsole();
  const store = await started(() => ({ openCompare: () => failed(GONE) }));

  expect([store.tabs.value, store.shown.value, store.columnLimit.value]).toEqual([[], null, 0]);
  expect(store.problem.value).toEqual({ action: "tabs", cause: GONE });
  expect(problemText({ action: "tabs", cause: GONE }, LINUX)).toBe(
    "Could not update the tabs: reading /data/tabs.json failed: denied",
  );
  expect(lines.error).toEqual([
    '[error] store.tabs_failed {kind: "ReadFailed", path: "/data/tabs.json", message: "denied"}',
  ]);
});

test("add, show, rename and language write the mirror from each reply (catches a reply not adopted)", async () => {
  const store = await started();
  const first = tabAt(store, 0);

  await store.addTab();
  const second = tabAt(store, 1);
  expect(store.tabs.value.map((entry) => entry.name)).toEqual(["Compare 1", "Compare 2"]);
  expect(store.shown.value).toBe(second);

  await store.showTab(first);
  expect(store.shown.value).toBe(first);

  await store.renameTab(second, "payloads");
  await store.setLanguage(first, { kind: "picked", name: "TypeScript" });
  expect(store.tabs.value.map(({ name, language }) => ({ name, language }))).toEqual([
    { name: "Compare 1", language: { kind: "picked", name: "TypeScript" } },
    { name: "payloads", language: { kind: "auto" } },
  ]);
});

test("a tab's view is kept once shown, in the list's order, with its latest entry, until it closes (catches views built for unopened tabs or kept after a close)", async () => {
  const store = await started();
  const first = tabAt(store, 0);
  expect(store.visited.value.map((entry) => entry.id)).toEqual([first]);

  await store.addTab();
  await store.addTab();
  const [second, third] = [tabAt(store, 1), tabAt(store, 2)];
  await store.showTab(first);
  expect(store.visited.value.map((entry) => entry.id)).toEqual([first, second, third]);

  await store.closeTab(second);
  await store.renameTab(third, "later");
  expect(store.visited.value).toEqual(store.tabs.value);
  expect(store.visited.value.map((entry) => entry.name)).toEqual(["Compare 1", "later"]);
});

test("after a restart only the shown tab gets a view (catches every stored tab mounted at start)", async () => {
  const before = await started();
  await before.addTab();
  const list = { tabs: before.tabs.value, shown: tabAt(before, 0) };
  const store = await started((fixture) => ({
    openCompare: async () => {
      const start = await fixture.openCompare();
      return start.ok ? { ...start, value: { ...start.value, list } } : start;
    },
  }));

  expect(store.tabs.value).toBe(list.tabs);
  expect(store.visited.value).toEqual([list.tabs[0]]);
});

test.each([
  ["showTab", (store, tab) => store.showTab(tab)],
  ["addTab", (store) => store.addTab()],
] satisfies [string, Act][])(
  "%s from the settings view shows the tabs again (catches a tab switch hidden behind the settings)",
  async (_call, act) => {
    const store = await started();
    store.openSettings();

    await act(store, tabAt(store, 0));

    expect(store.screen.value).toEqual({ kind: "files" });
  },
);

test("a rename shows only once its reply arrives (catches an optimistic edit of the mirror)", async () => {
  const held = gate();
  const store = await started((fixture) => ({
    renameTab: async (tab, name) => {
      const reply = await fixture.renameTab(tab, name);
      await held.opened;
      return reply;
    },
  }));
  const before = store.tabs.value;

  const renaming = store.renameTab(tabAt(store, 0), "later");
  await Promise.resolve();
  expect(store.tabs.value).toBe(before);

  held.open();
  await renaming;
  expect(store.tabs.value.map((entry) => entry.name)).toEqual(["later"]);
});

test.each([
  ["addTab", { addTab: () => failed(UNKNOWN) }, (store) => store.addTab()],
  ["showTab", { showTab: () => failed(UNKNOWN) }, (store, tab) => store.showTab(tab)],
  ["renameTab", { renameTab: () => failed(UNKNOWN) }, (store, tab) => store.renameTab(tab, "x")],
  [
    "setLanguage",
    { setTabLanguage: () => failed(UNKNOWN) },
    (store, tab) => store.setLanguage(tab, { kind: "picked", name: "XML" }),
  ],
  ["closeTab", { closeTab: () => failed(UNKNOWN) }, (store, tab) => store.closeTab(tab)],
] satisfies [string, Partial<CompareSource>, Act][])(
  "a failed %s leaves the mirror as it was and shows the problem (catches a failure clearing the list)",
  async (_call, failing, act) => {
    spyConsole();
    const store = await started(() => failing);
    const tabs = store.tabs.value;
    const shown = store.shown.value;

    await act(store, tabAt(store, 0));

    expect(store.tabs.value).toBe(tabs);
    expect(store.shown.value).toBe(shown);
    expect(store.problem.value).toEqual({ action: "tabs", cause: UNKNOWN });
  },
);

test("a tab closed in another call is shown with its words, nothing listed again (catches a silent UnknownTab)", async () => {
  spyConsole();
  let starts = 0;
  const store = await started((fixture) => ({
    openCompare: () => {
      starts += 1;
      return fixture.openCompare();
    },
    closeTab: (tab) => failed({ kind: "UnknownTab", tab }),
  }));

  await store.closeTab(tabAt(store, 0));

  expect(starts).toBe(1);
  const shown = store.problem.value;
  expect(shown === null ? null : problemText(shown, LINUX)).toBe(
    "Could not update the tabs: that tab was closed.",
  );
});

test("a tab reply clears a tabs problem but not a column's (catches a stale tabs problem or a lost save problem)", async () => {
  spyConsole();
  let failing = true;
  const store = await started((fixture) => ({
    addTab: () => (failing ? failed(GONE) : fixture.addTab()),
    setColumn: () => failed(GONE),
  }));
  const tab = tabAt(store, 0);

  await store.addTab();
  expect(store.problem.value?.action).toBe("tabs");
  failing = false;
  await store.addTab();
  expect(store.problem.value).toBeNull();

  await store.saveColumn(tab, await sendOf(store, tab, "a"));
  await store.addTab();
  expect(store.problem.value?.action).toBe("saveTab");
});

test("closing a tab with text asks; No and Escape keep it, Yes closes it (catches a close without the question)", async () => {
  let closes = 0;
  const store = await started((fixture) => ({
    closeTab: (tab) => {
      closes += 1;
      return fixture.closeTab(tab);
    },
  }));
  const tab = tabAt(store, 0);
  await holdingText(store, tab);

  const no = store.closeTab(tab);
  expect(store.question.value).toEqual({ kind: "closeTab", name: "Compare 1" });
  store.answer(false);
  await no;
  const dismissed = store.closeTab(tab);
  store.dismissQuestion();
  await dismissed;
  expect(closes).toBe(0);
  expect(store.tabs.value.map((entry) => entry.id)).toEqual([tab]);

  const yes = store.closeTab(tab);
  store.answer(true);
  await yes;
  expect(closes).toBe(1);
  expect(store.question.value).toBeNull();
  expect(store.tabs.value.map((entry) => entry.id)).not.toContain(tab);
});

test("an empty tab closes at once, never asking (catches a question for a tab with nothing to lose)", async () => {
  const store = await started();
  await store.addTab();

  await store.closeTab(tabAt(store, 1));

  expect(store.question.value).toBeNull();
  expect(store.tabs.value.map((entry) => entry.name)).toEqual(["Compare 1"]);
});

test("a tab no longer listed is not closed again (catches a second close sent for a gone tab)", async () => {
  let closes = 0;
  const store = await started((fixture) => ({
    closeTab: (tab) => {
      closes += 1;
      return fixture.closeTab(tab);
    },
  }));
  await store.addTab();
  const second = tabAt(store, 1);
  await store.closeTab(second);

  await store.closeTab(second);

  expect(closes).toBe(1);
  expect(store.problem.value).toBeNull();
});

test("the mounted tab's holdsText wins over the stored entry's, both ways (catches the entry read for a mounted tab)", async () => {
  const store = await started();
  const first = tabAt(store, 0);
  await holdingText(store, first);
  await store.addTab();
  const second = tabAt(store, 1);
  const emptied = handle(false, [await sendOf(store, first, "unsent")]);
  store.track(first, emptied);
  store.track(second, handle(true));

  await store.closeTab(first);
  expect(store.question.value).toBeNull();
  expect(store.tabs.value.map((entry) => entry.name)).toEqual(["Compare 2"]);
  expect(emptied.asked).toEqual(["holdsText"]);

  const asking = store.closeTab(second);
  expect(store.question.value).toEqual({ kind: "closeTab", name: "Compare 2" });
  store.answer(false);
  await asking;
});

test("a closed tab is no longer flushed; one that failed to close still is (catches untracking on the wrong outcome)", async () => {
  spyConsole();
  let failing = false;
  const sent: TabId[] = [];
  const store = await started((fixture) => ({
    closeTab: (tab) => (failing ? failed(GONE) : fixture.closeTab(tab)),
    setColumn: (write) => {
      sent.push(write.tab);
      return fixture.setColumn(write);
    },
  }));
  await store.addTab();
  const [first, second] = [tabAt(store, 0), tabAt(store, 1)];
  store.track(first, handle(false, [await sendOf(store, first, "a")]));
  store.track(second, handle(false, [await sendOf(store, second, "b")]));

  await store.closeTab(first);
  failing = true;
  await store.closeTab(second);
  await store.flushAll();

  expect(sent).toEqual([second]);
});

test("flushAll sends each unsent column once and resolves only when every reply came (catches a close before the write)", async () => {
  spyConsole();
  const held = gate();
  const sent: string[] = [];
  const store = await started((fixture) => ({
    setColumn: async (write) => {
      sent.push(`${write.tab} ${write.column} ${write.text} ${write.version}`);
      await held.opened;
      return fixture.setColumn(write);
    },
  }));
  await store.addTab();
  const [first, second] = [tabAt(store, 0), tabAt(store, 1)];
  const left = await sendOf(store, first, "l");
  const firstHandle = handle(true, [left, { ...left, column: "right", text: "r" }]);
  store.track(first, firstHandle);
  store.track(second, handle(true, [await sendOf(store, second, "s")]));
  let flushed = false;

  const flushing = store.flushAll().then(() => {
    flushed = true;
  });
  await Promise.resolve();
  expect(flushed).toBe(false);
  held.open();
  await flushing;

  expect(sent).toEqual([`${first} left l 1`, `${first} right r 1`, `${second} left s 1`]);
  expect(firstHandle.asked).toEqual(["unsent"]);
});

test("a second close request while the first flush runs waits for that same flush, sending nothing twice (catches a window closed under a running write)", async () => {
  spyConsole();
  const held = gate();
  const sent: string[] = [];
  const store = await started((fixture) => ({
    setColumn: async (write) => {
      sent.push(write.text);
      await held.opened;
      return fixture.setColumn(write);
    },
  }));
  const tab = tabAt(store, 0);
  store.track(tab, handle(true, [await sendOf(store, tab, "once")]));
  let flushed = false;

  const first = store.flushAll();
  const second = store.flushAll();
  void second.then(() => {
    flushed = true;
  });
  await Promise.resolve();
  expect(second).toBe(first);
  expect([flushed, sent]).toEqual([false, ["once"]]);
  held.open();
  await second;

  await store.flushAll();
  expect(sent).toEqual(["once", "once"]);
});

test("flushAll waits for a save already in flight though nothing is left unsent (catches a close before a settle's write landed)", async () => {
  spyConsole();
  const held = gate();
  const store = await started((fixture) => ({
    setColumn: async (write) => {
      await held.opened;
      return fixture.setColumn(write);
    },
  }));
  const tab = tabAt(store, 0);
  const saving = store.saveColumn(tab, await sendOf(store, tab, "settled"));
  let flushed = false;

  const flushing = store.flushAll().then(() => {
    flushed = true;
  });
  for (let tick = 0; tick < MICROTASKS; tick += 1) {
    await Promise.resolve();
  }
  expect(flushed).toBe(false);
  held.open();
  await flushing;

  expect((await saving)?.versions.left).toBe(1);
});

test("a failed flush is shown and logged, never thrown (catches a close stopped by one bad column)", async () => {
  const lines = spyConsole();
  const store = await started(() => ({ setColumn: () => Promise.reject(new Error("ipc gone")) }));
  const tab = tabAt(store, 0);
  store.track(tab, handle(true, [await sendOf(store, tab, "x")]));

  await store.flushAll();

  expect(store.problem.value).toEqual({
    action: "saveTab",
    tab,
    column: "left",
    name: "Compare 1",
    cause: { kind: "Unexpected", message: "ipc gone" },
  });
  expect(lines.error).toEqual([
    '[error] store.saveTab_failed {name: "Compare 1", kind: "Unexpected", message: "ipc gone"}',
  ]);
});

test("untracking removes only the handle it returned (catches a remount's handle dropped by the old one)", async () => {
  spyConsole();
  const sent: string[] = [];
  const store = await started((fixture) => ({
    setColumn: (write) => {
      sent.push(write.text);
      return fixture.setColumn(write);
    },
  }));
  const tab = tabAt(store, 0);
  const untrackOld = store.track(tab, handle(true, [await sendOf(store, tab, "old")]));
  const untrackNew = store.track(tab, handle(true, [await sendOf(store, tab, "new")]));

  untrackOld();
  await store.flushAll();
  untrackNew();
  await store.flushAll();

  expect(sent).toEqual(["new"]);
});

test("loadTab returns the stored texts, or null with the tab's problem (catches a failure passed on as texts)", async () => {
  const lines = spyConsole();
  let failing = false;
  const store = await started((fixture) => ({
    loadTab: (tab) => (failing ? failed({ kind: "UnknownTab", tab }) : fixture.loadTab(tab)),
  }));
  const tab = tabAt(store, 0);

  expect(await store.loadTab(tab)).toMatchObject({ left: "", right: "" });
  failing = true;

  expect(await store.loadTab(tab)).toBeNull();
  const failure = { action: "loadTab", name: "Compare 1", cause: { kind: "UnknownTab", tab } };
  expect(store.problem.value).toEqual(failure);
  expect(lines.error).toEqual([
    `[error] store.loadTab_failed {name: "Compare 1", kind: "UnknownTab", tab: ${tab}}`,
  ]);
});

test("saveColumn writes the column and returns the comparison, or null naming the tab as it was called (catches a save naming no tab)", async () => {
  spyConsole();
  const held = gate();
  const writes: string[] = [];
  const store = await started((fixture) => ({
    setColumn: async (write) => {
      writes.push(`${write.tab} ${write.column} ${write.text} ${write.version}`);
      if (write.text === "late") {
        await held.opened;
      }
      return fixture.setColumn(write);
    },
  }));
  await store.addTab();
  const [first, second] = [tabAt(store, 0), tabAt(store, 1)];
  const right: ColumnSend = { ...(await sendOf(store, second, "b")), column: "right" };

  const comparison: Comparison | null = await store.saveColumn(second, right);
  expect(comparison?.versions).toEqual({ left: 0, right: 1 });
  expect(writes).toEqual([`${second} right b 1`]);

  const late = store.saveColumn(second, { ...right, text: "late" });
  await store.closeTab(second);
  held.open();
  expect(await late).toBeNull();
  expect(store.problem.value).toEqual({
    action: "saveTab",
    tab: second,
    column: "right",
    name: "Compare 2",
    cause: { kind: "UnknownTab", tab: second },
  });
  expect(store.tabs.value.map((entry) => entry.id)).toEqual([first]);
});

test("a successful save clears that column's save problem only (catches a stale 'Could not save' after the column saved)", async () => {
  spyConsole();
  let failing = true;
  const store = await started((fixture) => ({
    setColumn: (write) => (failing ? failed(GONE) : fixture.setColumn(write)),
  }));
  await store.addTab();
  const [first, second] = [tabAt(store, 0), tabAt(store, 1)];
  const left = await sendOf(store, first, "a");
  const right: ColumnSend = { ...left, column: "right" };

  await store.saveColumn(first, left);
  failing = false;
  await store.saveColumn(first, right);
  await store.saveColumn(second, await sendOf(store, second, "b"));
  expect(store.problem.value).toMatchObject({ action: "saveTab", tab: first, column: "left" });

  await store.saveColumn(first, left);
  expect(store.problem.value).toBeNull();
});

test("a Format on a tab replaces its earlier Format notices, keeping refused edits and other tabs' (catches a stale 'not valid JSON' after a good Format)", async () => {
  const store = await started();
  await store.addTab();
  const [first, second] = [tabAt(store, 0), tabAt(store, 1)];
  const json: ColumnFormatFailure = {
    column: "left",
    language: "JSON",
    message: "Expected ',' or '}'",
    line: 3,
  };

  store.refused(first, "right");
  store.reportFormat(second, [json]);
  store.reportFormat(first, [json]);
  store.reportFormat(first, []);

  expect(store.notices.value.map((row) => row.text)).toEqual([
    "Compare 1, right: not pasted — a column holds up to 8 MiB",
    "Compare 2, left: not valid JSON (line 3): Expected ',' or '}'",
  ]);

  store.reportFormat(second, [{ ...json, column: "right" }]);

  expect(store.notices.value.map((row) => row.text)).toEqual([
    "Compare 1, right: not pasted — a column holds up to 8 MiB",
    "Compare 2, right: not valid JSON (line 3): Expected ',' or '}'",
  ]);
});

test("a refused edit and a Format failure show their words; a second one for the column replaces the first (catches piled-up notices)", async () => {
  const store = await started();
  await store.addTab();
  const [first, second] = [tabAt(store, 0), tabAt(store, 1)];
  const json: ColumnFormatFailure = {
    column: "left",
    language: "JSON",
    message: "Expected ',' or '}'",
    line: 3,
  };

  store.refused(second, "right");
  store.reportFormat(second, [json, { ...json, column: "right", language: "XML", line: 9 }]);
  store.refused(first, "right");

  expect(store.notices.value.map((row) => row.text)).toEqual([
    "Compare 2, left: not valid JSON (line 3): Expected ',' or '}'",
    "Compare 2, right: not valid XML (line 9): Expected ',' or '}'",
    "Compare 1, right: not pasted — a column holds up to 8 MiB",
  ]);

  store.refused(second, "left");
  store.reportFormat(first, [{ ...json, column: "right", line: 1 }]);

  expect(store.notices.value.map((row) => row.text)).toEqual([
    "Compare 2, right: not valid XML (line 9): Expected ',' or '}'",
    "Compare 2, left: not pasted — a column holds up to 8 MiB",
    "Compare 1, right: not valid JSON (line 1): Expected ',' or '}'",
  ]);
});

test("closing a notice removes only that notice (catches every notice closed at once)", async () => {
  const store = await started();
  const tab = tabAt(store, 0);
  store.refused(tab, "left");
  store.refused(tab, "right");
  const [left] = store.notices.value;

  store.dismissNotice(left?.key ?? "");

  expect(store.notices.value.map((row) => row.text)).toEqual([
    "Compare 1, right: not pasted — a column holds up to 8 MiB",
  ]);
});

test("Auto's finding is kept per tab (catches one tab's finding wiping another's)", async () => {
  const store = await started();
  await store.addTab();
  const [first, second] = [tabAt(store, 0), tabAt(store, 1)];

  store.setDetected(first, "JSON");
  store.setDetected(second, null);
  store.setDetected(first, "XML");

  expect(store.detected.value).toEqual(
    new Map<TabId, string | null>([
      [first, "XML"],
      [second, null],
    ]),
  );
});

test("the gear switches the screen, and the settings in use reach the preferences (catches a settings view that never opens)", async () => {
  const store = await started();

  store.openSettings();
  expect(store.screen.value).toEqual({ kind: "settings" });
  await store.setTheme("light");
  expect(store.preferences.value.theme).toBe("light");
  store.closeSettings();
  expect(store.screen.value).toEqual({ kind: "files" });
});

test("a shown problem closes on request (catches a problem bar that cannot close)", async () => {
  spyConsole();
  const store = await started(() => ({ addTab: () => failed(GONE) }));
  await store.addTab();

  store.dismissProblem();

  expect(store.problem.value).toBeNull();
});

test("the bound key toggles the tab panel through the shared rule, never while a question waits (catches a compare window that cannot hide its tabs)", async () => {
  const store = await started();
  const tab = tabAt(store, 0);
  await holdingText(store, tab);
  let prevents = 0;
  const ctrlB: KeyPress = {
    key: "b",
    code: "KeyB",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    defaultPrevented: false,
    preventDefault: () => {
      prevents += 1;
    },
  };

  store.fileListKey(ctrlB, LINUX);
  expect([store.fileListShown.value, prevents]).toEqual([false, 1]);

  const closing = store.closeTab(tab);
  store.fileListKey(ctrlB, LINUX);
  expect([store.fileListShown.value, prevents]).toEqual([false, 1]);
  store.answer(false);
  await closing;

  store.fileListKey(ctrlB, LINUX);
  expect([store.fileListShown.value, prevents]).toEqual([true, 2]);
});
