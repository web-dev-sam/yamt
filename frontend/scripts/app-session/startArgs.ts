import { join } from "node:path";

import { noPositionals, sessionName, wholeNumber, type Parsed } from "./argv";
import { fromRoot } from "./session";
import type { Size } from "./state";

type Opening =
  | { readonly kind: "dir"; readonly dir: string }
  | { readonly kind: "range"; readonly range: string; readonly dir: string }
  | { readonly kind: "diff"; readonly startDir: string | null }
  | { readonly kind: "fresh" };

export type Recording = { readonly file: string; readonly seconds: number };

export type StartCommand =
  | {
      readonly kind: "start-app";
      readonly name: string;
      readonly binary: string;
      readonly opens: Opening;
      readonly settings: string | null;
      readonly size: Size;
      readonly record: Recording | null;
      readonly home: string | null;
      readonly glab: string | null;
      readonly ai: boolean;
    }
  | {
      readonly kind: "start-fixture";
      readonly name: string;
      readonly size: Size;
      readonly search: string;
    };

const DEFAULT_SIZE: Size = { width: 1600, height: 1000 };
const DEFAULT_BINARY = "target/debug/yamt";
const SIZE = /^([1-9][0-9]*)x([1-9][0-9]*)$/;

function size(parsed: Parsed): Size {
  const text = parsed.values.get("size");
  if (text === undefined) {
    return DEFAULT_SIZE;
  }
  const [, width, height] = SIZE.exec(text) ?? [];
  if (width === undefined || height === undefined) {
    throw new Error(`--size ${text}: expected <width>x<height>, e.g. 1600x1000`);
  }
  return { width: Number(width), height: Number(height) };
}

function opening(parsed: Parsed): Opening {
  const dir = parsed.values.get("repo");
  const range = parsed.values.get("range");
  const startDir = parsed.values.get("dir");
  const diff = parsed.flags.has("diff");
  const fresh = parsed.flags.has("fresh-repo");
  if (startDir !== undefined && !diff) {
    throw new Error("start-app --dir <folder> goes with --diff: the compare window's start folder");
  }
  if (range !== undefined) {
    if (dir === undefined || diff || fresh) {
      throw new Error("start-app --range needs --repo <dir>, and neither --fresh-repo nor --diff");
    }
    return { kind: "range", range, dir };
  }
  if ([dir !== undefined, fresh, diff].filter(Boolean).length !== 1) {
    throw new Error("start-app needs one of --repo <dir>, --fresh-repo and --diff");
  }
  if (dir !== undefined) {
    return { kind: "dir", dir };
  }
  return diff ? { kind: "diff", startDir: startDir ?? null } : { kind: "fresh" };
}

function addAiSearch(parsed: Parsed, review: URLSearchParams): void {
  const named = parsed.values.get("ai-case");
  const changes = parsed.flags.has("ai-changes");
  if (!parsed.flags.has("ai")) {
    if (named !== undefined || changes) {
      throw new Error("start-fixture takes --ai-case and --ai-changes only with --ai");
    }
    return;
  }
  review.set("ai", named ?? "");
  if (changes) {
    review.set("ai-changes", "");
  }
}

function reviewSearch(parsed: Parsed): string {
  const review = new URLSearchParams();
  for (const name of ["threads", "gitlab"]) {
    const value = parsed.values.get(name);
    if (value !== undefined) {
      review.set(name, value);
    }
  }
  addAiSearch(parsed, review);
  const text = review.toString();
  return text === "" ? "" : `&${text}`;
}

function windowSearch(parsed: Parsed): string {
  const range = parsed.values.get("range-case");
  const fixture = parsed.values.get("diff-case");
  const diff = parsed.flags.has("diff") ? "?diff" : "";
  const review = reviewSearch(parsed);
  if (range !== undefined) {
    if (fixture !== undefined || diff !== "") {
      throw new Error("start-fixture takes --range-case without --diff or --diff-case");
    }
    return `?range=${encodeURIComponent(range)}${review}`;
  }
  if (review !== "") {
    throw new Error("start-fixture takes --threads, --gitlab and --ai only with --range-case");
  }
  return fixture === undefined ? diff : `?diff=${encodeURIComponent(fixture)}`;
}

function fixtureSearch(parsed: Parsed): string {
  const search = windowSearch(parsed);
  const script = parsed.values.get("mr");
  if (script === undefined) {
    return search;
  }
  if (search === "") {
    throw new Error(
      "start-fixture takes --mr only with --diff, --diff-case or --range-case: the merge window has no merge-request page",
    );
  }
  return `${search}&mr=${encodeURIComponent(script)}`;
}

export function glabFolder(scenario: string, isFolder: (path: string) => boolean): string {
  const folder = fromRoot(join("tests/glab", scenario));
  if (!isFolder(folder)) {
    throw new Error(`--glab ${scenario}: no scenario folder ${folder}`);
  }
  return folder;
}

function glabScenario(parsed: Parsed, opens: Opening): string | null {
  const scenario = parsed.values.get("glab");
  if (scenario === undefined) {
    return null;
  }
  if (opens.kind !== "range" && opens.kind !== "diff") {
    throw new Error(
      "start-app --glab <scenario> needs --range or --diff: only the range and compare windows run glab",
    );
  }
  if (!/^[a-z0-9-]+$/.test(scenario)) {
    throw new Error(`--glab ${scenario}: expected a folder name under tests/glab/, e.g. lined-up`);
  }
  return scenario;
}

function recording(parsed: Parsed): Recording | null {
  const file = parsed.values.get("record");
  const seconds = parsed.values.get("record-seconds");
  if (file === undefined && seconds === undefined) {
    return null;
  }
  if (file === undefined || seconds === undefined) {
    throw new Error("--record and --record-seconds go together");
  }
  return { file, seconds: wholeNumber(seconds, "--record-seconds", 1) };
}

function settingsText(parsed: Parsed): string | null {
  const text = parsed.values.get("settings");
  if (text === undefined) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`--settings is not JSON: ${reason}`, { cause: error });
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`--settings must be a JSON object, got ${text}`);
  }
  return text;
}

export function appArgs(opens: Opening, repoDir: string | null, ai: boolean): readonly string[] {
  const options = [...(repoDir === null ? [] : ["--repo", repoDir]), ...(ai ? ["--ai"] : [])];
  switch (opens.kind) {
    case "diff":
      return ["--diff", ...options];
    case "range":
      return [`--diff=${opens.range}`, ...options];
    case "dir":
    case "fresh":
      return options;
  }
}

export function startCommand(kind: StartCommand["kind"], parsed: Parsed): StartCommand {
  noPositionals(parsed);
  const name = sessionName(parsed);
  if (kind === "start-fixture") {
    return { kind, name, size: size(parsed), search: fixtureSearch(parsed) };
  }
  const opens = opening(parsed);
  return {
    kind,
    name,
    binary: parsed.values.get("binary") ?? DEFAULT_BINARY,
    opens,
    settings: settingsText(parsed),
    size: size(parsed),
    record: recording(parsed),
    home: parsed.values.get("home") ?? null,
    glab: glabScenario(parsed, opens),
    ai: parsed.flags.has("ai"),
  };
}
