import { expect, test } from "vitest";

import {
  isNamed,
  isVisible,
  nameOf,
  parseCandidates,
  pickByCss,
  pickByName,
  roleOf,
  type Candidate,
} from "./find";

const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";

function candidate(id: string, fields: Partial<Omit<Candidate, "element">>): Candidate {
  return {
    element: { [ELEMENT_KEY]: id },
    tag: "div",
    type: "",
    href: false,
    role: "",
    ariaLabel: "",
    title: "",
    label: "",
    text: "",
    width: 20,
    height: 10,
    visibility: "visible",
    hiddenAbove: false,
    ...fields,
  };
}

function query(name: string, role: string | null = null, nth: number | null = null) {
  return { name, role, nth };
}

test("aria-label wins over title, title over text", () => {
  expect(
    nameOf(candidate("1", { tag: "button", ariaLabel: " Next  change ", title: "T", text: "X" })),
  ).toBe("Next change");
  expect(nameOf(candidate("2", { tag: "button", title: "Settings", text: "X" }))).toBe("Settings");
  expect(nameOf(candidate("3", { tag: "button", text: "Dark" }))).toBe("Dark");
});

test("text names only roles that take their name from content", () => {
  expect(nameOf(candidate("1", { tag: "div", text: "Dark" }))).toBe("");
  expect(nameOf(candidate("2", { tag: "li", text: "Dark" }))).toBe("");
  expect(nameOf(candidate("3", { tag: "section", text: "Dark" }))).toBe("");
  expect(nameOf(candidate("4", { tag: "li", role: "option", text: "src/a.ts" }))).toBe("src/a.ts");
  expect(nameOf(candidate("5", { tag: "h3", text: "Theme" }))).toBe("Theme");
  expect(nameOf(candidate("6", { tag: "a", href: true, text: "Docs" }))).toBe("Docs");
  expect(nameOf(candidate("7", { tag: "a", text: "Docs" }))).toBe("");
});

test("roles: the first explicit token, else the tag's implicit role", () => {
  expect(roleOf(candidate("1", { tag: "div", role: " menuitem  button" }))).toBe("menuitem");
  expect(roleOf(candidate("2", { tag: "section" }))).toBe("region");
  expect(roleOf(candidate("3", { tag: "input", type: "checkbox" }))).toBe("checkbox");
  expect(roleOf(candidate("4", { tag: "input", type: "text" }))).toBe("textbox");
  expect(roleOf(candidate("5", { tag: "input" }))).toBe("textbox");
  expect(roleOf(candidate("6", { tag: "a", href: true }))).toBe("link");
  expect(roleOf(candidate("7", { tag: "span" }))).toBe("");
});

test("an element is hidden by visibility, an empty box, or an aria-hidden or inert ancestor", () => {
  expect(isVisible(candidate("1", {}))).toBe(true);
  expect(isVisible(candidate("2", { visibility: "hidden" }))).toBe(false);
  expect(isVisible(candidate("3", { visibility: "collapse" }))).toBe(false);
  expect(isVisible(candidate("4", { width: 0 }))).toBe(false);
  expect(isVisible(candidate("5", { height: 0 }))).toBe(false);
  expect(isVisible(candidate("6", { hiddenAbove: true }))).toBe(false);
});

test("a hidden element with the same name is never picked", () => {
  const settings = [
    candidate("hidden-file", { tag: "button", ariaLabel: "Settings", visibility: "hidden" }),
    candidate("shown-file", { tag: "button", ariaLabel: "Settings" }),
    candidate("collapsed", { tag: "button", ariaLabel: "Settings", width: 0, height: 0 }),
  ];
  expect(pickByName(settings, query("Settings")).element[ELEMENT_KEY]).toBe("shown-file");
});

test("only hidden matches is an error that counts and lists them", () => {
  const hidden = [
    candidate("a", { tag: "button", ariaLabel: "Next change", visibility: "hidden" }),
    candidate("b", { tag: "button", ariaLabel: "Next change", hiddenAbove: true }),
  ];
  expect(() => pickByName(hidden, query("Next change"))).toThrow(
    'no visible element named "Next change"; 2 hidden: 0: button "Next change" (hidden); 1: button "Next change" (hidden)',
  );
});

test("several visible matches is an error naming each; --nth counts visible ones only", () => {
  const buttons = [
    candidate("a", { tag: "button", text: "Dark" }),
    candidate("hidden", { tag: "button", text: "Dark", visibility: "hidden" }),
    candidate("b", { tag: "button", text: "Dark" }),
  ];
  expect(() => pickByName(buttons, query("Dark"))).toThrow(
    '2 visible elements named "Dark": 0: button "Dark"; 1: button "Dark"; pass --nth <i> or --role <role>',
  );
  expect(pickByName(buttons, query("Dark", null, 1)).element[ELEMENT_KEY]).toBe("b");
  expect(() => pickByName(buttons, query("Dark", null, 2))).toThrow(
    /--nth 2: only 2 visible element\(s\) named "Dark"/,
  );
});

test("--role tells a button from a region with the same name", () => {
  const both = [
    candidate("region", { tag: "section", ariaLabel: "Settings" }),
    candidate("gear", { tag: "button", ariaLabel: "Settings" }),
  ];
  expect(pickByName(both, query("Settings", "button")).element[ELEMENT_KEY]).toBe("gear");
  expect(pickByName(both, query("Settings", "region")).element[ELEMENT_KEY]).toBe("region");
  expect(() => pickByName(both, query("Settings", "link"))).toThrow(
    /no element named "Settings" with role link/,
  );
});

test("a missing name suggests visible elements whose names contain it", () => {
  const toolbar = [
    candidate("1", { tag: "button", ariaLabel: "Next change" }),
    candidate("2", { tag: "button", ariaLabel: "Previous change" }),
    candidate("3", { tag: "button", ariaLabel: "Next file", visibility: "hidden" }),
  ];
  expect(() => pickByName(toolbar, query("next"))).toThrow(
    'no element named "next"; similar: 0: button "Next change"',
  );
  expect(() => pickByName(toolbar, query("Zoom"))).toThrow(
    'no element named "Zoom"; nothing similar',
  );
});

test("isNamed compares whitespace-normalised names and the role", () => {
  const button = candidate("1", { tag: "button", text: "Mark  resolved" });
  expect(isNamed(button, query(" Mark resolved "))).toBe(true);
  expect(isNamed(button, query("Mark resolved", "button"))).toBe(true);
  expect(isNamed(button, query("Mark resolved", "link"))).toBe(false);
  expect(isNamed(button, query("Mark"))).toBe(false);
});

test("CSS matches are picked by visibility and role, with the same errors", () => {
  const panes = [
    candidate("hidden", { visibility: "hidden" }),
    candidate("left", {}),
    candidate("right", {}),
  ];
  expect(() => pickByCss(panes, query(".cm-scroller"))).toThrow(
    /2 visible elements matching CSS ".cm-scroller"/,
  );
  expect(pickByCss(panes, query(".cm-scroller", null, 1)).element[ELEMENT_KEY]).toBe("right");
  expect(() => pickByCss(panes, query(".cm-scroller", "button"))).toThrow(
    'no visible element matching CSS ".cm-scroller" with role button',
  );
});

test("a CSS match inside aria-hidden is picked when painted; a name never picks it", () => {
  const icons = [
    candidate("unpainted", { hiddenAbove: true, width: 0 }),
    candidate("icon", { hiddenAbove: true, ariaLabel: "Apply" }),
  ];
  expect(pickByCss(icons, query(".chunk-action-apply rect")).element[ELEMENT_KEY]).toBe("icon");
  expect(() => pickByName(icons, query("Apply"))).toThrow(/no visible element named "Apply"/);
});

test("an input is named by its labels (wrapping or for=), after aria-label and before title", () => {
  const toggle = candidate("ruff", {
    tag: "input",
    type: "checkbox",
    role: "switch",
    label: " ruff ",
  });
  expect(nameOf(toggle)).toBe("ruff");
  expect(pickByName([toggle], query("ruff", "switch")).element[ELEMENT_KEY]).toBe("ruff");
  expect(nameOf(candidate("2", { tag: "input", label: "ruff", title: "T" }))).toBe("ruff");
  expect(nameOf(candidate("3", { tag: "input", label: "ruff", ariaLabel: "Lint" }))).toBe("Lint");
});

test("parseCandidates reads the page's records and rejects a malformed one", () => {
  const record = {
    element: { [ELEMENT_KEY]: "e1" },
    tag: "button",
    type: "",
    href: false,
    role: "",
    ariaLabel: "Settings",
    title: "Settings",
    label: "",
    text: "",
    width: 28,
    height: 28,
    visibility: "visible",
    hiddenAbove: false,
  };
  expect(parseCandidates([record])).toEqual([record]);
  expect(() => parseCandidates([{ ...record, width: "28" }])).toThrow(/field "width"/);
  expect(() => parseCandidates([{ ...record, element: {} }])).toThrow(new RegExp(ELEMENT_KEY));
  expect(() => parseCandidates({ value: [] })).toThrow(/expected a list/);
});
