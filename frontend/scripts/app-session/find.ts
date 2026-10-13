import { booleanField, numberField, recordOf, stringField } from "./json";

// W3C WebDriver web element identifier: https://www.w3.org/TR/webdriver2/#elements
const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";
const MAX_TEXT_CHARS = 200;
const SHOWN_CANDIDATES = 12;

type ElementRef = Readonly<Record<typeof ELEMENT_KEY, string>>;

export type Candidate = {
  readonly element: ElementRef;
  readonly tag: string;
  readonly type: string;
  readonly href: boolean;
  readonly role: string;
  readonly ariaLabel: string;
  readonly title: string;
  readonly text: string;
  readonly width: number;
  readonly height: number;
  readonly visibility: string;
  readonly hiddenAbove: boolean;
};

// ARIA 1.2 roles supporting name from content: https://www.w3.org/TR/wai-aria-1.2/#namefromcontent
const NAME_FROM_CONTENT: Readonly<Record<string, true>> = {
  button: true,
  cell: true,
  checkbox: true,
  columnheader: true,
  gridcell: true,
  heading: true,
  link: true,
  menuitem: true,
  menuitemcheckbox: true,
  menuitemradio: true,
  option: true,
  radio: true,
  row: true,
  rowheader: true,
  switch: true,
  tab: true,
  tooltip: true,
  treeitem: true,
};

// HTML-AAM implicit roles: https://www.w3.org/TR/html-aam-1.0/#html-element-role-mappings
const IMPLICIT_ROLES: Readonly<Record<string, string>> = {
  aside: "complementary",
  button: "button",
  dialog: "dialog",
  footer: "contentinfo",
  form: "form",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  header: "banner",
  li: "listitem",
  main: "main",
  nav: "navigation",
  ol: "list",
  option: "option",
  section: "region",
  select: "combobox",
  td: "cell",
  textarea: "textbox",
  th: "columnheader",
  tr: "row",
  ul: "list",
};

const INPUT_ROLES: Readonly<Record<string, string>> = {
  button: "button",
  checkbox: "checkbox",
  radio: "radio",
  reset: "button",
  submit: "button",
};

export const NAMED_SELECTOR =
  "[aria-label], [title], [role], button, a[href], h1, h2, h3, h4, h5, h6, option, td, th, tr, input[type=checkbox], input[type=radio]";

export const COLLECT_SCRIPT = `
const found = [];
for (const element of document.querySelectorAll(arguments[0])) {
  const rect = element.getBoundingClientRect();
  found.push({
    element,
    tag: element.localName,
    type: element.getAttribute("type") ?? "",
    href: element.hasAttribute("href"),
    role: element.getAttribute("role") ?? "",
    ariaLabel: element.getAttribute("aria-label") ?? "",
    title: element.getAttribute("title") ?? "",
    text: (element.textContent ?? "").replace(/\\s+/g, " ").trim().slice(0, ${MAX_TEXT_CHARS}),
    width: rect.width,
    height: rect.height,
    visibility: getComputedStyle(element).visibility,
    hiddenAbove: element.closest('[aria-hidden="true"], [inert]') !== null,
  });
}
return found;`;

function parseCandidate(value: unknown): Candidate {
  const record = recordOf(value, "candidate");
  const element = recordOf(record["element"], "element");
  return {
    element: { [ELEMENT_KEY]: stringField(element, ELEMENT_KEY) },
    tag: stringField(record, "tag"),
    type: stringField(record, "type"),
    href: booleanField(record, "href"),
    role: stringField(record, "role"),
    ariaLabel: stringField(record, "ariaLabel"),
    title: stringField(record, "title"),
    text: stringField(record, "text"),
    width: numberField(record, "width"),
    height: numberField(record, "height"),
    visibility: stringField(record, "visibility"),
    hiddenAbove: booleanField(record, "hiddenAbove"),
  };
}

export function parseCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value)) {
    throw new Error(`element search: expected a list, got ${JSON.stringify(value)}`);
  }
  return value.map(parseCandidate);
}

export function roleOf(candidate: Candidate): string {
  if (candidate.role !== "") {
    return candidate.role.trim().split(/\s+/)[0] ?? "";
  }
  if (candidate.tag === "a") {
    return candidate.href ? "link" : "";
  }
  if (candidate.tag === "input") {
    return INPUT_ROLES[candidate.type] ?? "textbox";
  }
  return IMPLICIT_ROLES[candidate.tag] ?? "";
}

function normalised(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function nameOf(candidate: Candidate): string {
  const label = normalised(candidate.ariaLabel);
  if (label !== "") {
    return label;
  }
  const title = normalised(candidate.title);
  if (title !== "") {
    return title;
  }
  return NAME_FROM_CONTENT[roleOf(candidate)] === true ? normalised(candidate.text) : "";
}

export function isVisible(candidate: Candidate): boolean {
  return (
    candidate.width > 0 &&
    candidate.height > 0 &&
    candidate.visibility === "visible" &&
    !candidate.hiddenAbove
  );
}

function listed(candidates: readonly Candidate[]): string {
  const shown = candidates.slice(0, SHOWN_CANDIDATES).map((candidate, i) => {
    const role = roleOf(candidate) === "" ? candidate.tag : roleOf(candidate);
    const state = isVisible(candidate) ? "" : " (hidden)";
    return `${i}: ${role} "${nameOf(candidate)}"${state}`;
  });
  const more =
    candidates.length > SHOWN_CANDIDATES ? `; … ${candidates.length - SHOWN_CANDIDATES} more` : "";
  return `${shown.join("; ")}${more}`;
}

function pickVisible(matches: readonly Candidate[], nth: number | null, what: string): Candidate {
  const visible = matches.filter(isVisible);
  if (visible.length === 0) {
    const hidden = matches.length === 0 ? "" : `; ${matches.length} hidden: ${listed(matches)}`;
    throw new Error(`no visible element ${what}${hidden}`);
  }
  if (nth !== null) {
    const chosen = visible[nth];
    if (chosen === undefined) {
      throw new Error(
        `--nth ${nth}: only ${visible.length} visible element(s) ${what}: ${listed(visible)}`,
      );
    }
    return chosen;
  }
  const [only, ...others] = visible;
  if (only === undefined || others.length > 0) {
    throw new Error(
      `${visible.length} visible elements ${what}: ${listed(visible)}; pass --nth <i> or --role <role>`,
    );
  }
  return only;
}

export type Query = {
  readonly name: string;
  readonly role: string | null;
  readonly nth: number | null;
};

function hasRole(candidate: Candidate, role: string | null): boolean {
  return role === null || roleOf(candidate) === role;
}

function described(what: string, role: string | null): string {
  return role === null ? what : `${what} with role ${role}`;
}

export function isNamed(candidate: Candidate, query: Query): boolean {
  return nameOf(candidate) === normalised(query.name) && hasRole(candidate, query.role);
}

export function pickByName(candidates: readonly Candidate[], query: Query): Candidate {
  const what = described(`named "${normalised(query.name)}"`, query.role);
  const matches = candidates.filter((candidate) => isNamed(candidate, query));
  if (matches.length === 0) {
    const lower = normalised(query.name).toLowerCase();
    const similar = candidates.filter(
      (candidate) => isVisible(candidate) && nameOf(candidate).toLowerCase().includes(lower),
    );
    const near = similar.length === 0 ? "nothing similar" : `similar: ${listed(similar)}`;
    throw new Error(`no element ${what}; ${near}`);
  }
  return pickVisible(matches, query.nth, what);
}

export function pickByCss(matches: readonly Candidate[], query: Query): Candidate {
  const what = described(`matching CSS "${query.name}"`, query.role);
  return pickVisible(
    matches.filter((candidate) => hasRole(candidate, query.role)),
    query.nth,
    what,
  );
}
