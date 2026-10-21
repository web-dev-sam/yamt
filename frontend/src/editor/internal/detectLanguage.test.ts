import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { expect, test } from "vitest";

import { detectLanguage } from "./detectLanguage";

test("detectLanguage: a '{' opens JSON only before a string or '}' (catches any '{' accepted)", () => {
  expect(detectLanguage('{"a":1}', "")).toBe("JSON");
  expect(detectLanguage("{\n  }", "")).toBe("JSON");
  expect(detectLanguage("{ foo }", "")).toBeNull();
});

test("detectLanguage: a '[' opens JSON only before a value or ']', so an INI section is plain text (catches any '[' accepted)", () => {
  expect(detectLanguage("[section]\nkey=value", "")).toBeNull();
  expect(detectLanguage("[1, 2]", "")).toBe("JSON");
  for (const opening of [
    "[]",
    '[ {"a":1}]',
    "[[",
    '["x"]',
    "[-1]",
    "[true]",
    "[false]",
    "[null]",
  ]) {
    expect(detectLanguage(opening, "")).toBe("JSON");
  }
});

test("detectLanguage: an HTML doctype or <html> is HTML before the tag rule (catches the XML rule placed before HTML)", () => {
  expect(detectLanguage("<!DOCTYPE html>\n<html>", "")).toBe("HTML");
  expect(detectLanguage("<!doctype HTML>", "")).toBe("HTML");
  expect(detectLanguage('<HTML lang="en">', "")).toBe("HTML");
  expect(detectLanguage("<htmlx/>", "")).toBe("XML");
});

test("detectLanguage: PHP, an XML declaration, a comment or a tag", () => {
  expect(detectLanguage("<?php echo 1;", "")).toBe("PHP");
  expect(detectLanguage('<?xml version="1.0"?><html/>', "")).toBe("XML");
  expect(detectLanguage("<!-- note -->", "")).toBe("XML");
  expect(detectLanguage("<note/>", "")).toBe("XML");
  expect(detectLanguage("< note", "")).toBeNull();
  expect(detectLanguage("a < b", "")).toBeNull();
});

test("detectLanguage: '#!' names the interpreter with its version stripped (catches the version not stripped)", () => {
  expect(detectLanguage("#!/usr/bin/env python3\nprint(1)", "")).toBe("Python");
  expect(detectLanguage("#!/usr/bin/python3.11", "")).toBe("Python");
  expect(detectLanguage("#!/usr/bin/sqlite3 -init\n.tables", "")).toBe("SQLite");
  expect(detectLanguage("#! /usr/bin/env -S node --no-warnings\n", "")).toBe("JavaScript");
  expect(detectLanguage("#!/bin/bash\necho", "")).toBe("Shell");
  expect(detectLanguage("#!/usr/bin/awk -f", '{"a":1}')).toBe("JSON");
  expect(detectLanguage("#!", "")).toBeNull();
});

test("detectLanguage: leading whitespace and a BOM are skipped (catches no trim)", () => {
  expect(detectLanguage(' \n\t\uFEFF {"a":1}', "")).toBe("JSON");
  expect(detectLanguage("\uFEFF<?xml?>", "")).toBe("XML");
});

test("detectLanguage: the left wins, the right is read when the left finds nothing (catches the columns swapped)", () => {
  expect(detectLanguage("<a/>", '{"a":1}')).toBe("XML");
  expect(detectLanguage("plain words", '{"a":1}')).toBe("JSON");
  expect(detectLanguage("   ", "<a/>")).toBe("XML");
  expect(detectLanguage("plain", "words")).toBeNull();
});

test("detectLanguage: only the first 4,096 characters after the whitespace are read (catches the whole text read)", () => {
  expect(detectLanguage(`  {${" ".repeat(4094)}"a": 1}`, "")).toBe("JSON");
  expect(detectLanguage(`  {${" ".repeat(4095)}"a": 1}`, "")).toBeNull();
});

test("detectLanguage: every name it returns is a language-data name (catches a name spelled unlike language-data's)", () => {
  const openings = [
    '{"a":1}',
    "<a/>",
    "<html>",
    "<?php",
    "#!/bin/sh",
    "#!/usr/bin/env ruby",
    "#!/usr/bin/perl",
  ];
  for (const opening of openings) {
    const name = detectLanguage(opening, "");

    expect(name).not.toBeNull();
    expect(LanguageDescription.matchLanguageName(languages, name ?? "")?.name).toBe(name);
  }
});
