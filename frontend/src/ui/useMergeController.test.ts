import { afterEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, shallowRef, type EffectScope, type ShallowRef } from "vue";

import { bindingsOf, DEFAULT_KEYS, loadFixture, type FileMergeData } from "../ipc";
import { LanguageServers } from "../lsp";
import {
  useMergeController,
  type MergeHandle,
  type MergeSummary,
  type Preferences,
} from "./useMergeController";

type Counts = { errors: number; warnings: number; other: number };
type Summary = MergeSummary;

const editor = vi.hoisted(() => {
  const state = {
    text: "",
    built: 0,
    destroyed: 0,
    readOnly: new Array<boolean>(),
    themes: new Array<string>(),
    collapsed: new Array<string>(),
    minimap: new Array<string>(),
    servers: new Array<unknown>(),
    counts: { errors: 0, warnings: 0, other: 0 },
    summary: { conflicts: 0, changes: 0, remembered: 0 },
    countsListener: (_counts: Counts): void => {},
    summaryListener: (_summary: Summary): void => {},
    unsavedListener: (_unsaved: boolean): void => {},
  };
  class MergeController {
    readonly #id: number;
    constructor(
      data: FileMergeData,
      _hosts: unknown,
      options: {
        readOnly: boolean;
        preferences: { theme: string };
        collapsed: boolean;
        minimap: boolean;
        servers: unknown;
      },
    ) {
      state.text = data.middle.kind === "DiskNotText" ? "" : data.middle.text;
      state.built += 1;
      this.#id = state.built;
      state.readOnly.push(options.readOnly);
      state.themes.push(`built ${options.preferences.theme}`);
      state.collapsed.push(`${this.#id} built ${options.collapsed}`);
      state.minimap.push(`${this.#id} built ${options.minimap}`);
      state.servers.push(options.servers);
    }
    summary(): Summary {
      return state.summary;
    }
    onSummaryChange(listener: (summary: Summary) => void): void {
      state.summaryListener = listener;
    }
    problems(): Counts {
      return state.counts;
    }
    onProblemsChange(listener: (counts: Counts) => void): void {
      state.countsListener = listener;
    }
    format(): Promise<{ kind: "formatted"; server: string }> {
      return Promise.resolve({ kind: "formatted", server: `oxfmt in editor ${this.#id}` });
    }
    setPreferences(preferences: { theme: string }): void {
      state.themes.push(`set ${preferences.theme}`);
    }
    setCollapsed(on: boolean): void {
      state.collapsed.push(`${this.#id} set ${on}`);
    }
    showMinimap(shown: boolean): void {
      state.minimap.push(`${this.#id} show ${shown}`);
    }
    snapshot(): { asShown(): string; editor: number } {
      const text = state.text;
      return { asShown: () => text, editor: this.#id };
    }
    onUnsavedChange(listener: (unsaved: boolean) => void): void {
      state.unsavedListener = listener;
    }
    destroy(): void {
      state.destroyed += 1;
    }
  }
  return { state, MergeController };
});

vi.mock("../editor", () => ({ MergeController: editor.MergeController }));

const DARK: Preferences = { theme: "dark", keys: DEFAULT_KEYS };

afterEach(() => {
  Object.assign(editor.state, {
    text: "",
    built: 0,
    destroyed: 0,
    readOnly: [],
    themes: [],
    collapsed: [],
    minimap: [],
    servers: [],
    counts: { errors: 0, warnings: 0, other: 0 },
    summary: { conflicts: 0, changes: 0, remembered: 0 },
    countsListener: () => {},
    summaryListener: () => {},
    unsavedListener: () => {},
  });
});

function host<T>(present: boolean): ShallowRef<T | null> {
  return shallowRef<T | null>(present ? Object.create(null) : null);
}

function mount(
  data: ShallowRef<FileMergeData | null>,
  {
    present = true,
    readOnly = shallowRef(false),
    preferences = shallowRef(DARK),
    collapsed = shallowRef(true),
    minimap = shallowRef(false),
    servers = shallowRef<LanguageServers | null>(null),
  } = {},
): { scope: EffectScope; handle: MergeHandle } {
  const scope = effectScope();
  const handle = scope.run(() =>
    useMergeController(
      data,
      {
        left: host(present),
        center: host(present),
        right: host(present),
        strips: [host(present), host(present)],
      },
      { readOnly, preferences, collapsed, minimap, servers },
    ),
  );
  if (handle === undefined) {
    throw new Error("the scope did not run");
  }
  return { scope, handle };
}

async function fileData(text: string): Promise<FileMergeData> {
  return { ...(await loadFixture("vueuse-use-magic-keys.ts")), middle: { kind: "Disk", text } };
}

test("unsaved: false when built, then what the editor reports; false again for an editor rebuilt after a disk change", async () => {
  const data = shallowRef<FileMergeData | null>(await fileData("git's merge\n"));
  const { scope, handle } = mount(data);
  await nextTick();

  expect(editor.state.built).toBe(1);
  expect(handle.snapshot()?.asShown()).toBe("git's merge\n");
  expect(handle.unsaved.value).toBe(false);

  editor.state.unsavedListener(true);
  expect(handle.unsaved.value).toBe(true);

  editor.state.unsavedListener(false);
  expect(handle.unsaved.value).toBe(false);

  editor.state.unsavedListener(true);
  data.value = await fileData("changed on disk\n");
  await nextTick();

  expect(editor.state).toMatchObject({ built: 2, destroyed: 1, readOnly: [false, false] });
  expect(handle.snapshot()).toMatchObject({ editor: 2 });
  expect(handle.snapshot()?.asShown()).toBe("changed on disk\n");
  expect(handle.unsaved.value).toBe(false);

  editor.state.unsavedListener(true);
  scope.stop();

  expect(editor.state.destroyed).toBe(2);
  expect(handle.snapshot()).toBeNull();
  expect(handle.unsaved.value).toBe(false);
});

test("without data or hosts there is no editor: no snapshot, nothing unsaved", async () => {
  const empty = mount(shallowRef<FileMergeData | null>(null));
  const hostless = mount(shallowRef<FileMergeData | null>(await fileData("loaded\n")), {
    present: false,
  });
  await nextTick();

  for (const { handle } of [empty, hostless]) {
    expect(handle.snapshot()).toBeNull();
    expect(handle.unsaved.value).toBe(false);
    expect(handle.summary.value).toBeNull();
  }
  expect(editor.state.built).toBe(0);
});

test("the editor is read-only as the view says, and is rebuilt when that changes", async () => {
  const readOnly = shallowRef(true);
  mount(shallowRef<FileMergeData | null>(await fileData("b\n")), { readOnly });
  await nextTick();

  readOnly.value = false;
  await nextTick();

  expect(editor.state.readOnly).toEqual([true, false]);
  expect(editor.state.built).toBe(2);
});

test("the editor is built with the preferences in use and follows a change without a rebuild", async () => {
  const preferences = shallowRef<Preferences>({ theme: "light", keys: DEFAULT_KEYS });
  mount(shallowRef<FileMergeData | null>(await fileData("b\n")), { preferences });
  await nextTick();

  preferences.value = { theme: "dark", keys: bindingsOf({ apply: ["a"] }).bindings };
  await nextTick();

  expect(editor.state.themes).toEqual(["built light", "set dark"]);
  expect(editor.state.built).toBe(1);
  expect(editor.state.destroyed).toBe(0);
});

test("a preferences change before the file loaded reaches the editor built later", async () => {
  const data = shallowRef<FileMergeData | null>(null);
  const preferences = shallowRef<Preferences>(DARK);
  mount(data, { preferences });
  await nextTick();

  preferences.value = { theme: "light", keys: DEFAULT_KEYS };
  data.value = await fileData("b\n");
  await nextTick();

  expect(editor.state.themes).toEqual(["built light"]);
});

test("while the file is still loading, toolbar actions and the undo shortcut do nothing and throw nothing", async () => {
  const { handle } = mount(shallowRef<FileMergeData | null>(null));
  const ctrlZ: KeyboardEvent = Object.create(null);
  await nextTick();

  expect(editor.state.built).toBe(0);
  expect(() => {
    handle.applyAllNonConflicting("local");
    handle.moveToChange("down");
    handle.undo();
    handle.redo();
  }).not.toThrow();
  expect(handle.historyKey(ctrlZ)).toBe(false);
});

test("flipping collapsing before the file loaded reaches no editor and throws nothing", async () => {
  const collapsed = shallowRef(true);
  mount(shallowRef<FileMergeData | null>(null), { collapsed });
  await nextTick();

  collapsed.value = false;

  await expect(nextTick()).resolves.toBeUndefined();
  expect(editor.state.collapsed).toEqual([]);
});

test("an editor built while collapsing is off is told so, and a file loaded later follows the current choice", async () => {
  const collapsed = shallowRef(false);
  const data = shallowRef<FileMergeData | null>(await fileData("a\n"));
  mount(data, { collapsed });
  await nextTick();
  collapsed.value = true;
  await nextTick();
  data.value = await fileData("b\n");
  await nextTick();

  expect(editor.state.collapsed).toEqual(["1 built false", "1 set true", "2 built true"]);
});

test("flipping collapsing tells every live editor once, and a destroyed one never", async () => {
  const collapsed = shallowRef(true);
  const rebuilt = shallowRef<FileMergeData | null>(await fileData("a\n"));
  mount(rebuilt, { collapsed });
  mount(shallowRef<FileMergeData | null>(await fileData("b\n")), { collapsed });
  await nextTick();
  rebuilt.value = await fileData("c\n");
  await nextTick();
  editor.state.collapsed = [];

  collapsed.value = false;
  await nextTick();

  expect([...editor.state.collapsed].sort()).toEqual(["2 set false", "3 set false"]);
});

test("a preferences change never resets collapsing", async () => {
  const preferences = shallowRef<Preferences>(DARK);
  mount(shallowRef<FileMergeData | null>(await fileData("a\n")), { preferences });
  await nextTick();

  preferences.value = { theme: "light", keys: DEFAULT_KEYS };
  await nextTick();

  expect(editor.state.collapsed).toEqual(["1 built true"]);
  expect(editor.state.themes).toEqual(["built dark", "set light"]);
});

test("an editor is built showing the minimap as the view says, and follows a change without a rebuild", async () => {
  const minimap = shallowRef(true);
  mount(shallowRef<FileMergeData | null>(await fileData("a\n")), { minimap });
  await nextTick();

  minimap.value = false;
  await nextTick();
  minimap.value = true;
  await nextTick();

  expect(editor.state.built).toBe(1);
  expect(editor.state.minimap).toEqual(["1 built true", "1 show false", "1 show true"]);
});

test("a minimap shown before the file loaded reaches no editor, and the editor built later shows it", async () => {
  const minimap = shallowRef(false);
  const data = shallowRef<FileMergeData | null>(null);
  mount(data, { minimap });
  await nextTick();

  minimap.value = true;
  await nextTick();
  expect(editor.state.minimap).toEqual([]);

  data.value = await fileData("a\n");
  await nextTick();
  expect(editor.state.minimap).toEqual(["1 built true"]);
});

test("problems: the editor's counts when built, then each change it reports; null once it is gone", async () => {
  editor.state.counts = { errors: 2, warnings: 1, other: 0 };
  const data = shallowRef<FileMergeData | null>(await fileData("a\n"));
  const { scope, handle } = mount(data);
  await nextTick();

  expect(handle.problems.value).toEqual({ errors: 2, warnings: 1, other: 0 });

  editor.state.countsListener({ errors: 0, warnings: 0, other: 3 });

  expect(handle.problems.value).toEqual({ errors: 0, warnings: 0, other: 3 });

  data.value = null;
  await nextTick();

  expect(handle.problems.value).toBeNull();

  data.value = await fileData("b\n");
  await nextTick();
  scope.stop();

  expect(handle.problems.value).toBeNull();
});

test("summary: the editor's summary when built, then each change it reports, also from an editor rebuilt after a disk change", async () => {
  editor.state.summary = { conflicts: 2, changes: 5, remembered: 1 };
  const data = shallowRef<FileMergeData | null>(await fileData("a\n"));
  const { scope, handle } = mount(data);
  await nextTick();

  expect(handle.summary.value).toEqual({ conflicts: 2, changes: 5, remembered: 1 });

  editor.state.summaryListener({ conflicts: 1, changes: 5, remembered: 1 });

  expect(handle.summary.value).toEqual({ conflicts: 1, changes: 5, remembered: 1 });

  editor.state.summary = { conflicts: 3, changes: 3, remembered: 0 };
  data.value = await fileData("b\n");
  await nextTick();

  expect(handle.summary.value).toEqual({ conflicts: 3, changes: 3, remembered: 0 });

  editor.state.summaryListener({ conflicts: 0, changes: 3, remembered: 0 });

  expect(handle.summary.value).toEqual({ conflicts: 0, changes: 3, remembered: 0 });

  scope.stop();

  expect(handle.summary.value).toBeNull();
});

test("problems and format are null while no editor is built", async () => {
  const { handle } = mount(shallowRef<FileMergeData | null>(null));
  await nextTick();

  expect(handle.problems.value).toBeNull();
  await expect(handle.format()).resolves.toBeNull();
});

test("format answers with the outcome of the editor in use, a rebuilt one after a rebuild", async () => {
  const data = shallowRef<FileMergeData | null>(await fileData("a\n"));
  const { handle } = mount(data);
  await nextTick();

  await expect(handle.format()).resolves.toEqual({
    kind: "formatted",
    server: "oxfmt in editor 1",
  });

  data.value = await fileData("b\n");
  await nextTick();

  await expect(handle.format()).resolves.toEqual({
    kind: "formatted",
    server: "oxfmt in editor 2",
  });
});

test("the editor gets the language servers in use and is rebuilt when they change", async () => {
  const first = new LanguageServers(null);
  const second = new LanguageServers(null);
  const servers = shallowRef<LanguageServers | null>(first);
  mount(shallowRef<FileMergeData | null>(await fileData("a\n")), { servers });
  await nextTick();

  servers.value = second;
  await nextTick();
  servers.value = null;
  await nextTick();

  expect(editor.state.servers).toEqual([first, second, null]);
  expect(editor.state.servers[0]).toBe(first);
  expect(editor.state.servers[1]).toBe(second);
  expect(editor.state.destroyed).toBe(2);
});
