import { expect, test } from "vitest";

import type { AgentSource, CheckoutFolder, SourceResult } from "../ipc";
import { aiMayClose } from "./aiClose";
import type { Reply } from "./asking";
import type { Problem } from "./problem";
import type { Question } from "./question";

type Look = Awaited<ReturnType<AgentSource["checkoutChanges"]>>;

const FOLDER_TEXT = "/data/yamt/range/repo/pair/checkout";

function isFolder(path: string): path is CheckoutFolder {
  return path.startsWith("/");
}

function folder(): CheckoutFolder {
  if (!isFolder(FOLDER_TEXT)) {
    throw new Error(FOLDER_TEXT);
  }
  return FOLDER_TEXT;
}

class Closing {
  readonly asked: Question[] = [];
  readonly reported: Problem[] = [];
  discards = 0;
  look: Look = { ok: true, value: { kind: "Clean" } };
  reply: Reply = "yes";
  discarded: SourceResult<null> = { ok: true, value: null };

  async mayClose(): Promise<boolean> {
    return aiMayClose({
      source: {
        checkoutChanges: async () => this.look,
        discardCheckout: async () => {
          this.discards += 1;
          return this.discarded;
        },
      },
      asking: {
        ask: async (question) => {
          this.asked.push(question);
          return this.reply;
        },
      },
      report: (problem) => {
        this.reported.push(problem);
      },
    });
  }
}

function changed(): Look {
  return {
    ok: true,
    value: {
      kind: "Changed",
      folder: folder(),
      files: ["README.md"],
      refs: { branches: ["fix"], stash: true },
      headMoved: true,
    },
  };
}

test.each([["Missing"], ["Clean"]] as const)(
  "a %s checkout closes without asking or discarding",
  async (kind) => {
    const closing = new Closing();
    closing.look = { ok: true, value: { kind } };

    expect(await closing.mayClose()).toBe(true);
    expect([closing.asked, closing.discards]).toEqual([[], 0]);
  },
);

test("a changed checkout asks with its files, folder, moved HEAD and refs; Keep closes and discards nothing", async () => {
  const closing = new Closing();
  closing.look = changed();

  expect(await closing.mayClose()).toBe(true);
  expect(closing.asked).toEqual([
    {
      kind: "keepAiChanges",
      folder: FOLDER_TEXT,
      files: ["README.md"],
      headMoved: true,
      refs: { branches: ["fix"], stash: true },
    },
  ]);
  expect(closing.discards).toBe(0);
});

test("Discard removes the checkout, then closes", async () => {
  const closing = new Closing();
  closing.look = changed();
  closing.reply = "no";

  expect(await closing.mayClose()).toBe(true);
  expect([closing.discards, closing.reported]).toEqual([1, []]);
});

test("a failed discard stays open and shows the problem", async () => {
  const closing = new Closing();
  closing.look = changed();
  closing.reply = "no";
  const cause = { kind: "RemoveFailed", folder: FOLDER_TEXT, message: "busy" } as const;
  closing.discarded = { ok: false, failure: cause };

  expect(await closing.mayClose()).toBe(false);
  expect(closing.reported).toEqual([{ action: "ai", step: "discard", cause }]);
});

test("a discard that throws stays open and shows the problem", async () => {
  const closing = new Closing();
  closing.look = changed();
  closing.reply = "no";
  const asked = aiMayClose({
    source: {
      checkoutChanges: async () => closing.look,
      discardCheckout: async () => {
        throw new Error("ipc gone");
      },
    },
    asking: { ask: async () => "no" },
    report: (problem) => {
      closing.reported.push(problem);
    },
  });

  expect(await asked).toBe(false);
  expect(closing.reported).toEqual([
    { action: "ai", step: "discard", cause: { kind: "Unexpected", message: "ipc gone" } },
  ]);
});

test("Escape keeps the window open and discards nothing", async () => {
  const closing = new Closing();
  closing.look = changed();
  closing.reply = "dismissed";

  expect(await closing.mayClose()).toBe(false);
  expect([closing.discards, closing.reported]).toEqual([0, []]);
});

test("an unreadable checkout asks its own question with git's words", async () => {
  const closing = new Closing();
  closing.look = {
    ok: true,
    value: { kind: "Unreadable", folder: folder(), message: "fatal: bad object HEAD" },
  };
  closing.reply = "no";

  expect(await closing.mayClose()).toBe(true);
  expect(closing.asked).toEqual([
    { kind: "keepUnreadableCheckout", folder: FOLDER_TEXT, message: "fatal: bad object HEAD" },
  ]);
  expect(closing.discards).toBe(1);
});

test("a look that fails closes without asking: the shell keeps a changed checkout at exit", async () => {
  const closing = new Closing();
  closing.look = { ok: false, failure: { kind: "AiOff" } };

  expect(await closing.mayClose()).toBe(true);
  expect([closing.asked, closing.discards]).toEqual([[], 0]);
});
