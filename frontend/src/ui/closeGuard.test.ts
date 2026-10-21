import { afterEach, expect, test, vi } from "vitest";
import { shallowRef } from "vue";

import { loadFixture, type FileMergeData } from "../ipc";
import { createAsking } from "./asking";
import { createCloseGuard } from "./closeGuard";
import type { Problem } from "./problem";

const MAGIC_KEYS = await loadFixture("vueuse-use-magic-keys.ts");

afterEach(() => {
  vi.restoreAllMocks();
});

function guarded(unsaved: boolean) {
  const asking = createAsking();
  const target = {
    asking,
    opened: shallowRef<readonly FileMergeData[]>([{ ...MAGIC_KEYS, path: "a.ts" }]),
    problem: shallowRef<Problem | null>(null),
    running: shallowRef(false),
  };
  const guard = createCloseGuard(target);
  guard.track("a.ts", { unsaved: () => unsaved });
  return { ...target, guard };
}

test("while git runs a Continue or an Abort the close is refused with the problem, never a question", async () => {
  const lines: string[] = [];
  vi.spyOn(console, "info").mockImplementation((line: string) => {
    lines.push(line);
  });
  const window = guarded(true);
  window.running.value = true;

  expect(await window.guard.mayClose()).toBe(false);

  expect(window.asking.question.value).toBeNull();
  expect(window.problem.value).toEqual({ action: "close" });
  expect(lines).toEqual(['[info] store.close_refused {reason: "git_running"}']);
});

test("once git is done the close asks about unsaved edits again, and closes without any", async () => {
  const window = guarded(true);
  window.running.value = true;
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  await window.guard.mayClose();
  window.running.value = false;

  const asked = window.guard.mayClose();
  expect(window.asking.question.value).toEqual({ kind: "exit", files: ["a.ts"] });
  window.asking.answer(true);
  expect(await asked).toBe(true);

  expect(await guarded(false).guard.mayClose()).toBe(true);
});
