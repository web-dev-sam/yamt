import { expect, test } from "vitest";

import { ciBox, type CiBoxView, type CiStatusName } from "../index";

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
])("with no failed job a %s pipeline says so in words", (status, text) => {
  expect(ciBox<Job>(status, [], false)).toEqual({ kind: "status", text });
});
