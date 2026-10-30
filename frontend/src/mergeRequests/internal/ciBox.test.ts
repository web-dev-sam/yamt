import { expect, test } from "vitest";

import { ciBox, ciStatusText, type CiBoxView, type CiStatusName } from "../index";

type Job = { readonly name: string; readonly allowFailure: boolean };

function job(name: string, allowFailure = false): Job {
  return { name, allowFailure };
}

test("jobs allowed to fail come last, GitLab's order kept otherwise", () => {
  const jobs = [job("lint", true), job("test"), job("docs", true), job("build")];
  const view: CiBoxView<Job> = {
    kind: "jobs",
    jobs: [job("test"), job("build"), job("lint", true), job("docs", true)],
    more: false,
  };
  expect(ciBox("failed", jobs, false)).toEqual(view);
});

test("the box says more when GitLab has more failed jobs", () => {
  expect(ciBox("failed", [job("test")], true)).toEqual({
    kind: "jobs",
    jobs: [job("test")],
    more: true,
  });
});

test.each<[CiStatusName, string]>([
  ["passed", "Pipeline passed"],
  ["failed", "Pipeline failed"],
  ["running", "Pipeline running"],
  ["pending", "Pipeline pending"],
  ["canceled", "Pipeline canceled"],
  ["skipped", "Pipeline skipped"],
  ["manual", "Pipeline waiting for a manual job"],
])(
  "a %s pipeline's sentence is ciStatusText's, and the box shows it when no job failed",
  (status, text) => {
    expect(ciStatusText(status)).toBe(text);
    expect(ciBox<Job>(status, [], false)).toEqual({ kind: "status", text });
  },
);
