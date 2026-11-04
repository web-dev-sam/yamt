import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import { toLinksReply } from "./linksDomain";

function linksAt(page: (field: string) => string): Generated.LinksReply {
  const parent = {
    reference: "&3",
    title: "Board",
    page: page("links.issues[1].shown.parent.page"),
  };
  return {
    kind: "read",
    links: {
      epics: [{ reference: "&3", page: page("links.epics[0].page"), shown: null }],
      issues: [
        { reference: "#9", page: page("links.issues[0].page"), shown: null },
        {
          reference: "#12",
          page: page("links.issues[1].page"),
          shown: { title: "Snooze", closed: true, parent },
        },
        {
          reference: "#13",
          page: page("links.issues[2].page"),
          shown: { title: "Test", closed: false, parent: null },
        },
      ],
      commits: [{ reference: "fa3335f3", page: page("links.commits[0].page"), title: "Backfill" }],
    },
  };
}

const LINKS_FIELDS = [
  "links.epics[0].page",
  "links.issues[0].page",
  "links.issues[1].page",
  "links.issues[1].shown.parent.page",
  "links.issues[2].page",
  "links.commits[0].page",
];

test("every_links_page_is_branded_and_a_non_https_one_fails", () => {
  const raw = linksAt((field) => `https://gitlab.example/${field}`);
  expect(toLinksReply(raw)).toEqual(raw);
  for (const bad of LINKS_FIELDS) {
    for (const page of ["http://gitlab.example/x", "ftp://x"]) {
      const reply = linksAt((field) => (field === bad ? page : "https://gitlab.example/"));
      expect(() => toLinksReply(reply)).toThrow(`${bad} must be an https address, got "${page}"`);
    }
  }
});

test("a_links_refusal_passes_unchanged", () => {
  const replies: Generated.LinksReply[] = [
    { kind: "glabMissing" },
    { kind: "notLoggedIn", detail: "d" },
    { kind: "failed", message: "m" },
  ];
  for (const reply of replies) {
    expect(toLinksReply(reply)).toBe(reply);
  }
});
