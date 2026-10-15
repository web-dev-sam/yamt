import { expect, test } from "vitest";

import { absolutePath, fileUri, sameFile } from "./uri";

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

test("absolutePath joins a POSIX root, with or without a trailing slash, and a folder with /", () => {
  expect(absolutePath("/home/me/repo", "web/app")).toBe("/home/me/repo/web/app");
  expect(absolutePath("/home/me/repo/", "web")).toBe("/home/me/repo/web");
  expect(absolutePath("/home/me/repo/", "")).toBe("/home/me/repo");
});

test("absolutePath keeps a Windows root's backslashes and drops a trailing one", () => {
  expect(absolutePath("C:\\Users\\me\\repo", "web/app")).toBe("C:\\Users\\me\\repo\\web\\app");
  expect(absolutePath("C:\\repo\\", "web")).toBe("C:\\repo\\web");
  expect(absolutePath("C:\\repo\\", "")).toBe("C:\\repo");
});

test("absolutePath drops a verbatim Windows root's \\\\?\\ prefix, as fileUri does", () => {
  expect(absolutePath("\\\\?\\D:\\repo", "web")).toBe("D:\\repo\\web");
  expect(absolutePath("\\\\?\\D:\\repo\\", "")).toBe("D:\\repo");
  expect(fileUri("\\\\?\\D:\\repo\\", "web")).toBe("file:///D:/repo/web");
});

test("absolutePath keeps a UNC root's two leading backslashes", () => {
  expect(absolutePath("\\\\server\\share\\repo", "web")).toBe("\\\\server\\share\\repo\\web");
});

test("only a leading /X: is a drive: a POSIX folder with a colon keeps its path", () => {
  expect(absolutePath("/home/u/proj:v2", "src")).toBe("/home/u/proj:v2/src");
  expect(absolutePath("/home/u/x:", "src")).toBe("/home/u/x:/src");
  expect(absolutePath("/home/u", "x:/src")).toBe("/home/u/x:/src");
  expect(fileUri("/home/u/proj:v2", "src/a.ts")).toBe("file:///home/u/proj%3Av2/src/a.ts");
});

test("a URI that does not decode is never the same", () => {
  expect(sameFile("file:///a%25.ts", "file:///a%E0.ts")).toBe(false);
});
