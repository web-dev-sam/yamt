import { expect, test } from "vitest";

import { fileUri, sameFile } from "./uri";

test("a POSIX root and a repo-relative path make a file URI", () => {
  expect(fileUri("/home/me/repo", "src/a.ts")).toBe("file:///home/me/repo/src/a.ts");
});

test("an empty path is the root folder itself, without a trailing slash", () => {
  expect(fileUri("/home/me/repo/", "")).toBe("file:///home/me/repo");
});

test("spaces, # and non-ASCII are percent-encoded per segment and round-trip", () => {
  const uri = fileUri("/home/me/my repo", "src/#notes/größe ü.ts");

  expect(uri).toBe("file:///home/me/my%20repo/src/%23notes/gr%C3%B6%C3%9Fe%20%C3%BC.ts");
  expect(sameFile(uri, "file:///home/me/my repo/src/%23notes/größe ü.ts")).toBe(true);
  expect(sameFile(uri, "file:///home/me/my%20repo/src/%23notes/grosse.ts")).toBe(false);
});

test("a Windows drive root becomes file:///C:/ and matches a server's lower-case, encoded drive", () => {
  const uri = fileUri("C:\\Users\\me\\repo", "src/a b.ts");

  expect(uri).toBe("file:///C:/Users/me/repo/src/a%20b.ts");
  expect(sameFile(uri, "file:///c%3A/Users/me/repo/src/a%20b.ts")).toBe(true);
  expect(sameFile(uri, "file:///C%3A/Users/me/repo/src/a%20b.ts")).toBe(true);
  expect(sameFile(uri, "file:///d%3A/Users/me/repo/src/a%20b.ts")).toBe(false);
});

test("a verbatim Windows root loses its \\\\?\\ prefix", () => {
  expect(fileUri("\\\\?\\D:\\repo", "a.ts")).toBe("file:///D:/repo/a.ts");
});

test("a UNC root keeps its server as the URI authority", () => {
  expect(fileUri("\\\\server\\share\\repo", "a.ts")).toBe("file://server/share/repo/a.ts");
});

test("a URI that does not decode is never the same", () => {
  expect(sameFile("file:///a%25.ts", "file:///a%E0.ts")).toBe(false);
});
