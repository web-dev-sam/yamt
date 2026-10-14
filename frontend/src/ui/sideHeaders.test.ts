import { expect, test } from "vitest";

import type { Side, SideName, SideNames } from "../ipc";
import { sideHeader } from "./sideHeaders";

const COMMIT: SideName = {
  kind: "Commit",
  short_id: "1a2b3c4",
  subject: "Fix parser crash",
  message: "Fix parser crash\n\nThe lexer read past the end of the input.",
};

const LABEL: Readonly<Record<Side, string>> = {
  local: "Local (yours)",
  remote: "Remote (theirs)",
};

test.each<[Side, string]>([
  ["local", "local"],
  ["remote", "remote"],
])("a branch names the %s header, the same text on hover", (side, branch) => {
  const name: SideName = { kind: "Branch", name: branch };

  expect(sideHeader(side, { local: name, remote: name })).toEqual({
    text: `${LABEL[side]}: ${branch}`,
    tooltip: `${LABEL[side]}: ${branch}`,
  });
});

test.each<Side>(["local", "remote"])(
  "a commit shows its short id and subject in the %s header; hovering shows the full message",
  (side) => {
    expect(sideHeader(side, { local: COMMIT, remote: COMMIT })).toEqual({
      text: `${LABEL[side]}: 1a2b3c4 Fix parser crash`,
      tooltip: "Fix parser crash\n\nThe lexer read past the end of the input.",
    });
  },
);

test.each<Side>(["local", "remote"])("no name leaves the plain %s header", (side) => {
  expect(sideHeader(side, { local: null, remote: null })).toEqual({
    text: LABEL[side],
    tooltip: LABEL[side],
  });
});

test("each header reads its own side's name; the unnamed side stays plain", () => {
  const onlyLocal: SideNames = { local: COMMIT, remote: null };
  const onlyRemote: SideNames = { local: null, remote: { kind: "Branch", name: "minor" } };

  expect(sideHeader("local", onlyLocal).text).toBe("Local (yours): 1a2b3c4 Fix parser crash");
  expect(sideHeader("remote", onlyLocal)).toEqual({
    text: "Remote (theirs)",
    tooltip: "Remote (theirs)",
  });
  expect(sideHeader("remote", onlyRemote).text).toBe("Remote (theirs): minor");
  expect(sideHeader("local", onlyRemote)).toEqual({
    text: "Local (yours)",
    tooltip: "Local (yours)",
  });
});
