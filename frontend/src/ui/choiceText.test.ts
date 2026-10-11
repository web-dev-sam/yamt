import { expect, test } from "vitest";

import { loadFixture, type FileSides, type NotText, type SideContent } from "../ipc";
import { notTextLine, resultLine, sideButton, sideSentence, sideTooltip } from "./choiceText";

const COMMIT = "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b";
const MISSING: SideContent = { kind: "Missing" };
const BINARY: SideContent = { kind: "Binary", bytes: 12_697 };
const { diskVersion } = await loadFixture("word-marks.ts");

function sides(local: SideContent, remote: SideContent): FileSides {
  return { path: "logo.bin", reason: "Binary", local, remote, diskVersion };
}

test.each<[SideContent, string]>([
  [MISSING, "Deleted in this branch."],
  [{ kind: "Text", lines: 120 }, "A text file, 120 lines."],
  [{ kind: "Text", lines: 1 }, "A text file, 1 line."],
  [{ kind: "Text", lines: 0 }, "A text file, 0 lines."],
  [BINARY, "A binary file, 12.4 KB."],
  [{ kind: "NonUtf8", bytes: 3_174 }, "Not UTF-8 text, 3.1 KB."],
  [{ kind: "TooLarge", bytes: 9_646_899 }, "A text file too large to show, 9.2 MB."],
  [{ kind: "Link", target: "../shared/config.json" }, "A symbolic link to ../shared/config.json."],
  [{ kind: "Commit", id: COMMIT }, "Submodule at commit 1a2b3c4."],
])("%j reads %j", (content, sentence) => {
  expect(sideSentence(content)).toBe(sentence);
});

test.each([
  [0, "0 B"],
  [1023, "1023 B"],
  [1024, "1 KB"],
  [1536, "1.5 KB"],
  [1_048_524, "1023.9 KB"],
  [1_048_575, "1 MB"],
  [1_048_576, "1 MB"],
  [1_572_864, "1.5 MB"],
  [2_147_483_648, "2048 MB"],
])("%i bytes are %s", (bytes, size) => {
  expect(sideSentence({ kind: "Binary", bytes })).toBe(`A binary file, ${size}.`);
});

test("only a submodule side has a tooltip, its full commit id", () => {
  expect(sideTooltip({ kind: "Commit", id: COMMIT })).toBe(COMMIT);
  expect(sideTooltip(BINARY)).toBeUndefined();
  expect(sideTooltip({ kind: "Link", target: COMMIT })).toBeUndefined();
});

test("both sides present: Take left and Take right", () => {
  const both = sides(BINARY, { kind: "Link", target: "a" });

  expect(sideButton(both, "local")).toBe("Take left");
  expect(sideButton(both, "remote")).toBe("Take right");
});

test.each([
  ["local", sides(MISSING, BINARY), "Delete", "Keep"],
  ["remote", sides(BINARY, MISSING), "Keep", "Delete"],
] as const)(
  "deleted on the %s side: Delete there, Keep on the other",
  (_side, files, left, right) => {
    expect(sideButton(files, "local")).toBe(left);
    expect(sideButton(files, "remote")).toBe(right);
  },
);

test("after a choice the Result column names the side taken, or the deletion", () => {
  const both = sides(BINARY, { kind: "Text", lines: 2 });
  const deletedRemotely = sides(BINARY, MISSING);

  expect(resultLine(both, { by: "side", side: "local" })).toBe("Resolved with the left version.");
  expect(resultLine(both, { by: "side", side: "remote" })).toBe("Resolved with the right version.");
  expect(resultLine(deletedRemotely, { by: "side", side: "remote" })).toBe(
    "Resolved by deleting the file.",
  );
  expect(resultLine(deletedRemotely, { by: "side", side: "local" })).toBe(
    "Resolved with the left version.",
  );
});

test("a file the disk resolved says so in the Result column, whatever its sides", () => {
  expect(resultLine(sides(BINARY, MISSING), { by: "disk" })).toBe(
    "Changed on disk — staged as it is.",
  );
  expect(resultLine(sides(BINARY, BINARY), { by: "disk" })).toBe(
    "Changed on disk — staged as it is.",
  );
});

test("before a choice the Result column says what there is to choose", () => {
  expect(resultLine(sides(BINARY, { kind: "Link", target: "a" }), null)).toBe(
    "Take the left or the right version.",
  );
  expect(resultLine(sides(BINARY, MISSING), null)).toBe("Keep the file or delete it.");
  expect(resultLine(sides(MISSING, BINARY), null)).toBe("Keep the file or delete it.");
});

test.each<[NotText, string]>([
  ["Deleted", "Deleted on disk — staged as deleted."],
  ["Binary", "Not shown: the file on disk is binary — staged as it is."],
  ["NonUtf8", "Not shown: the file on disk is not UTF-8 — staged as it is."],
  ["TooLarge", "Not shown: the file on disk is too large — staged as it is."],
  ["Link", "A link on disk now — staged as it is."],
  ["Directory", "A folder on disk now — staged as deleted."],
])("a middle that is %s on disk reads %j", (found, line) => {
  expect(notTextLine(found)).toBe(line);
});
