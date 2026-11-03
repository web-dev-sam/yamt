import { expect, test } from "vitest";

import { startScreenOf } from "./startScreen";

test("only the marker mergeRequests starts a window on its merge-request page (catches any other value read as --mr)", () => {
  expect(startScreenOf("mergeRequests")).toBe("mergeRequests");
  expect(startScreenOf(undefined)).toBe("files");
  expect(startScreenOf(null)).toBe("files");
  expect(startScreenOf("")).toBe("files");
  expect(startScreenOf("mergerequests")).toBe("files");
});
