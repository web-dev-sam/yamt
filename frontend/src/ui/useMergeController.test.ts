import { afterEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, shallowRef, type EffectScope, type ShallowRef } from "vue";

import { loadFixture, type FileMergeData } from "../ipc";
import { useMergeController, type MergeHandle } from "./useMergeController";

const editor = vi.hoisted(() => {
  const state = { text: "", built: 0, destroyed: 0, readOnly: new Array<boolean>() };
  class MergeController {
    constructor(data: FileMergeData, _hosts: unknown, options: { readOnly: boolean }) {
      state.text = data.middle.kind === "DiskNotText" ? "" : data.middle.text;
      state.built += 1;
      state.readOnly.push(options.readOnly);
    }
    summary(): { conflicts: number; changes: number } {
      return { conflicts: 0, changes: 0 };
    }
    onSummaryChange(): void {}
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

afterEach(() => {
  Object.assign(editor.state, { text: "", built: 0, destroyed: 0, readOnly: [] });
});

function host<T>(present: boolean): ShallowRef<T | null> {
  return shallowRef<T | null>(present ? Object.create(null) : null);
}

function mount(
  data: ShallowRef<FileMergeData | null>,
  { present = true, readOnly = shallowRef(false) } = {},
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
      readOnly,
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

  expect(editor.state).toEqual({
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

test("while the file is still loading, toolbar actions and the undo shortcut do nothing and throw nothing", async () => {
  const { handle } = mount(shallowRef<FileMergeData | null>(null));
  const ctrlZ: KeyboardEvent = Object.create(null);
  await nextTick();

  expect(editor.state.built).toBe(0);
  expect(() => {
    handle.applyAllNonConflicting("local");
    handle.undo();
    handle.redo();
  }).not.toThrow();
  expect(handle.historyKey(ctrlZ)).toBe(false);
});
