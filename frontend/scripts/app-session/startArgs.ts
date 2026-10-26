import { existsSync } from "node:fs";
import { join } from "node:path";

import { noPositionals, sessionName, wholeNumber, type Parsed } from "./argv";
import { fromRoot } from "./session";
import type { Size } from "./state";

type Opening =
  | { readonly kind: "dir"; readonly dir: string }
  | { readonly kind: "range"; readonly range: string; readonly dir: string }
  | { readonly kind: "fresh" | "diff" };

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
  const diff = parsed.flags.has("diff");
  const fresh = parsed.flags.has("fresh-repo");
  if (range !== undefined) {
    if (dir === undefined || diff || fresh) {
      throw new Error("start-app --range needs --repo <dir>, and neither --fresh-repo nor --diff");
    }
    return { kind: "range", range, dir };
  }
  if ([dir !== undefined, fresh, diff].filter(Boolean).length !== 1) {
    throw new Error("start-app needs one of --repo <dir>, --fresh-repo and --diff");
  }
  return dir === undefined ? { kind: diff ? "diff" : "fresh" } : { kind: "dir", dir };
}

function reviewSearch(parsed: Parsed): string {
  const review = new URLSearchParams();
  for (const name of ["threads", "gitlab"]) {
    const value = parsed.values.get(name);
    if (value !== undefined) {
      review.set(name, value);
    }
  }
  const text = review.toString();
  return text === "" ? "" : `&${text}`;
}

function fixtureSearch(parsed: Parsed): string {
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
    throw new Error("start-fixture takes --threads and --gitlab only with --range-case");
  }
  return fixture === undefined ? diff : `?diff=${encodeURIComponent(fixture)}`;
}

export function glabFolder(scenario: string): string {
  return fromRoot(join("tests/glab", scenario));
}

export function glabScenario(
  parsed: Parsed,
  opens: Opening,
  isFolder: (path: string) => boolean,
): string | null {
  const scenario = parsed.values.get("glab");
  if (scenario === undefined) {
    return null;
  }
  if (opens.kind !== "range") {
    throw new Error("start-app --glab <scenario> needs --range: only the range window runs glab");
  }
  if (!/^[a-z0-9-]+$/.test(scenario)) {
    throw new Error(`--glab ${scenario}: expected a folder name under tests/glab/, e.g. lined-up`);
  }
  const folder = glabFolder(scenario);
  if (!isFolder(folder)) {
    throw new Error(`--glab ${scenario}: no scenario folder ${folder}`);
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

export function appArgs(opens: Opening, repoDir: string | null): readonly string[] {
  const repo = repoDir === null ? [] : ["--repo", repoDir];
  switch (opens.kind) {
    case "diff":
      return ["--diff", ...repo];
    case "range":
      return [`--diff=${opens.range}`, ...repo];
    case "dir":
    case "fresh":
      return repo;
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
    glab: glabScenario(parsed, opens, existsSync),
  };
}
