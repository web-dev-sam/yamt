import { expect, test, vi } from "vitest";

import { guardWindowClose } from "./window";

type CloseRequest = { preventDefault: () => void };

const handlers = vi.hoisted(() => new Array<(event: CloseRequest) => Promise<void>>());

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: (handler: (event: CloseRequest) => Promise<void>) => {
      handlers.push(handler);
      return Promise.resolve(() => undefined);
    },
  }),
}));

async function closeAnswered(answer: boolean): Promise<boolean> {
  handlers.length = 0;
  await guardWindowClose(() => Promise.resolve(answer));
  const prevented = vi.fn();
  await handlers[0]?.({ preventDefault: prevented });
  return prevented.mock.calls.length > 0;
}

test("the window stays open exactly when the check answers no", async () => {
  expect(await closeAnswered(false)).toBe(true);
  expect(await closeAnswered(true)).toBe(false);
  expect(handlers).toHaveLength(1);
});
