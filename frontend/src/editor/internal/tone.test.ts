import { expect, test } from "vitest";

import { loadFixture, type Chunk } from "../../ipc";
import { chunkTone } from "./tone";

async function chunkWith(
  kind: Chunk["kind"],
  lens: { middle: number; local: number; remote: number },
): Promise<Chunk> {
  const record = {
    path: "synthetic.ts",
    deleted: null,
    middle: { kind: "Stages", text: "" },
    local: "",
    remote: "",
    eol: "Lf",
    disk_version: 0,
    chunks: [
      {
        chunk: {
          id: 0,
          kind,
          base: { start: 0, len: 1 },
          local: { start: 0, len: lens.local },
          remote: { start: 0, len: lens.remote },
        },
        middle: { start: 0, len: lens.middle },
        words: {
          chunk: 0,
          local: { changed: [], removed_at: [] },
          remote: { changed: [], removed_at: [] },
        },
      },
    ],
  };
  const data = await loadFixture("synthetic.ts", { "synthetic.json": record });
  const [chunk] = data.chunks;
  if (chunk === undefined) {
    throw new Error("synthetic fixture lost its chunk");
  }
  return chunk;
}

test("a side that adds lines where the middle has none is inserted, whatever base held", async () => {
  const chunk = await chunkWith("LocalOnly", { middle: 0, local: 3, remote: 0 });

  expect(chunkTone(chunk, "local")).toBe("inserted");
});

test("a side that removes middle lines is deleted", async () => {
  const chunk = await chunkWith("RemoteOnly", { middle: 2, local: 2, remote: 0 });

  expect(chunkTone(chunk, "remote")).toBe("deleted");
});

test("a side that replaces middle lines is modified", async () => {
  const chunk = await chunkWith("LocalOnly", { middle: 2, local: 1, remote: 2 });

  expect(chunkTone(chunk, "local")).toBe("modified");
});

test("BothSame takes its tone from the side's own range on each side", async () => {
  const chunk = await chunkWith("BothSame", { middle: 4, local: 3, remote: 3 });

  expect(chunkTone(chunk, "local")).toBe("modified");
  expect(chunkTone(chunk, "remote")).toBe("modified");
});

test("a conflict is conflict on both sides, even where one side is empty", async () => {
  const chunk = await chunkWith("Conflict", { middle: 2, local: 0, remote: 5 });

  expect(chunkTone(chunk, "local")).toBe("conflict");
  expect(chunkTone(chunk, "remote")).toBe("conflict");
});

test("the center takes its tone from remote for RemoteOnly and from local otherwise", async () => {
  const remoteOnly = await chunkWith("RemoteOnly", { middle: 2, local: 2, remote: 0 });
  const localOnly = await chunkWith("LocalOnly", { middle: 2, local: 0, remote: 2 });

  expect(chunkTone(remoteOnly, "center")).toBe("deleted");
  expect(chunkTone(localOnly, "center")).toBe("deleted");
});
