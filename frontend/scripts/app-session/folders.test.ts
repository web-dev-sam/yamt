import { expect, test } from "vitest";

import { isOwnTempFolder, ownerConfigClash } from "./folders";

test("stop removes only this tool's temp folders directly under the temp root", () => {
  expect(isOwnTempFolder("/tmp/yamt-app-session-smoke-a1B2c3", "/tmp")).toBe(true);
  expect(isOwnTempFolder("/tmp/yamt-test-merge", "/tmp")).toBe(false);
  expect(isOwnTempFolder("/tmp/x/yamt-app-session-smoke-a1", "/tmp")).toBe(false);
  expect(isOwnTempFolder("/home/u/yamt-app-session-smoke-a1", "/tmp")).toBe(false);
  expect(isOwnTempFolder("/tmp", "/tmp")).toBe(false);
});

test("a config folder at or inside the owner's config folder is refused", () => {
  const owners = ["/home/u/.config", "/home/u/xdg"];
  expect(ownerConfigClash("/home/u/.config", owners)).toBe(
    "refusing to start: config folder /home/u/.config is inside the owner's /home/u/.config",
  );
  expect(ownerConfigClash("/home/u/xdg/tmp/home/.config", owners)).toMatch(
    /inside the owner's \/home\/u\/xdg$/,
  );
});

test("a private config folder, or a sibling sharing a prefix, is allowed", () => {
  const owners = ["/home/u/.config"];
  expect(ownerConfigClash("/tmp/yamt-app-session-smoke-x/home/.config", owners)).toBeNull();
  expect(ownerConfigClash("/home/u/.config-other", owners)).toBeNull();
  expect(ownerConfigClash("/home/u", owners)).toBeNull();
  expect(ownerConfigClash("/tmp/x", [])).toBeNull();
});
