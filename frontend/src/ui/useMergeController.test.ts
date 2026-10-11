import { afterEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, shallowRef, type EffectScope, type ShallowRef } from "vue";

import { loadFixture, type FileMergeData } from "../ipc";
import { useMergeController, type MergeHandle } from "./useMergeController";

const editor = vi.hoisted(() => {
  const state = { text: "", built: 0, destroyed: 0 };
  class MergeController {
    constructor(data: FileMergeData) {
      state.text = data.base;
      state.built += 1;
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
  Object.assign(editor.state, { text: "", built: 0, destroyed: 0 });
});

function host<T>(present: boolean): ShallowRef<T | null> {
  return shallowRef<T | null>(present ? Object.create(null) : null);
}

function mount(
  data: ShallowRef<FileMergeData | null>,
  present = true,
): { scope: EffectScope; handle: MergeHandle } {
  const scope = effectScope();
  const handle = scope.run(() =>
    useMergeController(data, {
      left: host(present),
      center: host(present),
      right: host(present),
      strips: [host(present), host(present)],
    }),
  );
  if (handle === undefined) {
    throw new Error("the scope did not run");
  }
  return { scope, handle };
}

async function fileData(base: string): Promise<FileMergeData> {
  return { ...(await loadFixture("vueuse-use-magic-keys.ts")), base };
}

test("unsaved: false when built, true after an edit, false after markSaved, false after new data", async () => {
  const data = shallowRef<FileMergeData | null>(await fileData("loaded\n"));
  const { scope, handle } = mount(data);
  await nextTick();

  expect(editor.state.built).toBe(1);
  expect(handle.resultText()).toBe("loaded\n");
  expect(handle.unsaved()).toBe(false);

  editor.state.text = "edited\n";
  expect(handle.unsaved()).toBe(true);

  handle.markSaved("edited\n");
  expect(handle.unsaved()).toBe(false);

  editor.state.text = "edited again\n";
  expect(handle.unsaved()).toBe(true);

  data.value = await fileData("reloaded\n");
  await nextTick();

  expect(editor.state).toEqual({ text: "reloaded\n", built: 2, destroyed: 1 });
  expect(handle.unsaved()).toBe(false);

  scope.stop();

  expect(editor.state.destroyed).toBe(2);
});

test("without data or hosts there is no editor: no text, nothing unsaved, markSaved is ignored", async () => {
  const empty = mount(shallowRef<FileMergeData | null>(null));
  const hostless = mount(shallowRef<FileMergeData | null>(await fileData("loaded\n")), false);
  await nextTick();

  for (const { handle } of [empty, hostless]) {
    handle.markSaved("x");
    expect(handle.resultText()).toBeNull();
    expect(handle.unsaved()).toBe(false);
    expect(handle.summary.value).toBeNull();
  }
  expect(editor.state.built).toBe(0);
});
