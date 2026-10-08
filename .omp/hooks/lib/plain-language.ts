import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type PlainLanguageLists = { ai_overused: string[]; project_jargon: string[]; id_patterns: string[] };

export type Flag = { term: string; excerpt: string };

export const PLAIN_LANGUAGE_LISTS = ".omp/hooks/lib/plain-language.json";

const EXCERPT_WORDS_BEFORE = 4;
const EXCERPT_WORDS_FROM_MATCH = 6;

function excerptAround(text: string, index: number): string {
  const wordStart = text.slice(0, index).search(/\S*$/);
  const before = text.slice(0, wordStart).split(/\s+/).filter(Boolean).slice(-EXCERPT_WORDS_BEFORE);
  const from = text.slice(wordStart).split(/\s+/).filter(Boolean).slice(0, EXCERPT_WORDS_FROM_MATCH);
  return [...before, ...from].join(" ");
}

export function flaggedTerms(strings: string[], lists: PlainLanguageLists): Flag[] {
  const patterns = [
    ...[...lists.ai_overused, ...lists.project_jargon].map(
      (phrase) => new RegExp(`(?<!\\w)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`, "i"),
    ),
    ...lists.id_patterns.map((p) => new RegExp(p, "i")),
  ];
  const flags: Flag[] = [];
  for (const text of strings) {
    for (const pattern of patterns) {
      const m = pattern.exec(text);
      if (m !== null) flags.push({ term: m[0], excerpt: excerptAround(text, m.index) });
    }
  }
  return flags;
}

export function readPlainLanguageLists(cwd: string): PlainLanguageLists | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(resolve(cwd, PLAIN_LANGUAGE_LISTS), "utf8"));
    if (parsed === null || typeof parsed !== "object") return undefined;
    const field = (key: string): string[] => {
      const value: unknown = Reflect.get(parsed, key);
      return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    };
    return { ai_overused: field("ai_overused"), project_jargon: field("project_jargon"), id_patterns: field("id_patterns") };
  } catch {
    return undefined;
  }
}

export function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, v]) => (key === "id" ? [] : stringsIn(v)));
}
