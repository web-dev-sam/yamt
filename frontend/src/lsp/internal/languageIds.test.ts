import { expect, test } from "vitest";

import { languageId } from "./languageIds";

test("language ids for the new presets' file types", () => {
  const ids = Object.fromEntries(
    [
      "a.php",
      "a.pyi",
      "a.c",
      "a.h",
      "a.cc",
      "a.cpp",
      "a.cxx",
      "a.hh",
      "a.hpp",
      "a.hxx",
      "a.bash",
    ].map((path) => [path.slice(2), languageId(path)]),
  );

  expect(ids).toEqual({
    php: "php",
    pyi: "python",
    c: "c",
    h: "c",
    cc: "cpp",
    cpp: "cpp",
    cxx: "cpp",
    hh: "cpp",
    hpp: "cpp",
    hxx: "cpp",
    bash: "shellscript",
  });
});
