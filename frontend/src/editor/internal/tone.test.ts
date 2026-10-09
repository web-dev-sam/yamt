import { expect, test } from "vitest";

import { createFixtureSource, log, type Chunk } from "../../ipc";
import { chunkTone } from "./tone";

async function chunkWith(
  kind: Chunk["kind"],
  lens: { base: number; local: number; remote: number },
): Promise<Chunk> {
  const record = {
    path: "synthetic.ts",
    base: "",
    local: "",
    remote: "",
    eol: "Lf",
    language: null,
    chunks: [
      {
        id: 0,
        kind,
        base: { start: 0, len: lens.base },
        local: { start: 0, len: lens.local },
        remote: { start: 0, len: lens.remote },
      },
    ],
  };
  const data = await createFixtureSource(log, { "synthetic.json": record }).loadFile(
    "synthetic.ts",
  );
  const [chunk] = data.chunks;
  if (chunk === undefined) {
    throw new Error("synthetic fixture lost its chunk");
  }
  return chunk;
}

test("a side that adds lines where base has none is inserted", async () => {
  const chunk = await chunkWith("LocalOnly", { base: 0, local: 3, remote: 0 });

  expect(chunkTone(chunk, "local")).toBe("inserted");
});

test("a side that removes base lines is deleted", async () => {
  const chunk = await chunkWith("RemoteOnly", { base: 2, local: 2, remote: 0 });

  expect(chunkTone(chunk, "remote")).toBe("deleted");
});

test("a side that replaces base lines is modified", async () => {
  const chunk = await chunkWith("LocalOnly", { base: 2, local: 1, remote: 2 });

  expect(chunkTone(chunk, "local")).toBe("modified");
});

test("BothSame takes its tone from the side's own range on each side", async () => {
  const chunk = await chunkWith("BothSame", { base: 4, local: 3, remote: 3 });

  expect(chunkTone(chunk, "local")).toBe("modified");
  expect(chunkTone(chunk, "remote")).toBe("modified");
});

test("a conflict is conflict on both sides, even where one side is empty", async () => {
  const chunk = await chunkWith("Conflict", { base: 2, local: 0, remote: 5 });

  expect(chunkTone(chunk, "local")).toBe("conflict");
  expect(chunkTone(chunk, "remote")).toBe("conflict");
});
