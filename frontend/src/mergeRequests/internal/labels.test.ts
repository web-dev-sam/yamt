import { expect, test } from "vitest";

import { labelsShown, moreText, type ListedLabel } from "../index";

const BUG: ListedLabel = { title: "bug" };
const UI: ListedLabel = { title: "ui" };
const DOCS: ListedLabel = { title: "docs" };

test("no label shows nothing", () => {
  expect(labelsShown([])).toEqual({ first: null, rest: [] });
});

test("one label shows alone", () => {
  expect(labelsShown([BUG])).toEqual({ first: BUG, rest: [] });
});

test("three labels show the first in GitLab's order, the other two behind +2", () => {
  const shown = labelsShown([UI, BUG, DOCS]);
  expect(shown).toEqual({ first: UI, rest: [BUG, DOCS] });
  expect(moreText(shown.rest.length)).toBe("+2");
});

test("moreText counts the hidden ones", () => {
  expect(moreText(2)).toBe("+2");
  expect(moreText(12)).toBe("+12");
});
