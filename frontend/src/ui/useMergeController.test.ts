import { afterEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, shallowRef, type EffectScope, type ShallowRef } from "vue";

import { bindingsOf, DEFAULT_KEYS, loadFixture, type FileMergeData } from "../ipc";
import { useMergeController, type MergeHandle, type Preferences } from "./useMergeController";

const editor = vi.hoisted(() => {
  const state = {
    text: "",
    built: 0,
    destroyed: 0,
    readOnly: new Array<boolean>(),
    themes: new Array<string>(),
    collapsed: new Array<string>(),
  };
  class MergeController {
    readonly #id: number;
    constructor(
      data: FileMergeData,
      _hosts: unknown,
      options: { readOnly: boolean; preferences: { theme: string }; collapsed: boolean },
    ) {
      state.text = data.middle.kind === "DiskNotText" ? "" : data.middle.text;
      state.built += 1;
      this.#id = state.built;
      state.readOnly.push(options.readOnly);
      state.themes.push(`built ${options.preferences.theme}`);
      state.collapsed.push(`${this.#id} built ${options.collapsed}`);
    }
    summary(): { conflicts: number; changes: number } {
      return { conflicts: 0, changes: 0 };
    }
    onSummaryChange(): void {}
    setPreferences(preferences: { theme: string }): void {
      state.themes.push(`set ${preferences.theme}`);
    }
    setCollapsed(on: boolean): void {
      state.collapsed.push(`${this.#id} set ${on}`);
    }
    resultText(): string {
      return state.text;
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
      { readOnly, preferences, collapsed },
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

test("unsaved: false when built, true after an edit, false after markSaved, false after the file changed on disk", async () => {
  const data = shallowRef<FileMergeData | null>(await fileData("git's merge\n"));
  const { scope, handle } = mount(data);
  await nextTick();

  expect(editor.state.built).toBe(1);
  expect(handle.resultText()).toBe("git's merge\n");
  expect(handle.unsaved()).toBe(false);

  editor.state.text = "edited\n";
  expect(handle.unsaved()).toBe(true);

  handle.markSaved("edited\n");
  expect(handle.unsaved()).toBe(false);

  editor.state.text = "typed in yamt\n";
  expect(handle.unsaved()).toBe(true);

  data.value = await fileData("changed on disk\n");
  await nextTick();

  expect(editor.state).toMatchObject({
    text: "changed on disk\n",
    built: 2,
    destroyed: 1,
    readOnly: [false, false],
  });
  expect(handle.resultText()).toBe("changed on disk\n");
  expect(handle.unsaved()).toBe(false);

  scope.stop();

  expect(editor.state.destroyed).toBe(2);
});

test("without data or hosts there is no editor: no text, nothing unsaved, markSaved is ignored", async () => {
  const empty = mount(shallowRef<FileMergeData | null>(null));
  const hostless = mount(shallowRef<FileMergeData | null>(await fileData("loaded\n")), {
    present: false,
  });
  await nextTick();

  for (const { handle } of [empty, hostless]) {
    handle.markSaved("x");
    expect(handle.resultText()).toBeNull();
    expect(handle.unsaved()).toBe(false);
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
