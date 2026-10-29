import type { LineHit, Matcher } from "./match";
import { type Preview, previewOf } from "./preview";

export type LineRange = { readonly start: number; readonly len: number };
export type Layout<P extends string> = { readonly panes: readonly [P, ...P[]]; readonly lead: P };
export type SearchedFile<P extends string> = {
  readonly path: string;
  readonly texts: Readonly<Record<P, string | null>>;
  readonly changes: readonly Readonly<Record<P, LineRange>>[];
};
export type PaneHit = { readonly line: number; readonly from: number; readonly to: number };
export type PaneEntry<P extends string> = { readonly pane: P; readonly hit: PaneHit };
export type PlaceKey = string & { readonly __brand: "PlaceKey" };
export type Place<P extends string> = {
  readonly key: PlaceKey;
  readonly hits: readonly [PaneEntry<P>, ...PaneEntry<P>[]];
  readonly preview: Preview;
};

type Spot =
  | { readonly kind: "in"; readonly change: number; readonly leadStart: number }
  | { readonly kind: "out"; readonly aligned: number };

type Found<P extends string> = { readonly pane: P; readonly hit: LineHit; readonly spot: Spot };

type Group<P extends string> = [Found<P>, ...Found<P>[]];

type Order = {
  readonly anchor: number;
  readonly phase: number;
  readonly paneRank: number;
  readonly line: number;
  readonly from: number;
};

const ORDER_FIELDS = ["anchor", "phase", "paneRank", "line", "from"] as const;

function isPlaceKey(text: string): text is PlaceKey {
  return text.startsWith("[");
}

function placeKey(parts: readonly unknown[]): PlaceKey {
  const text = JSON.stringify(parts);
  if (!isPlaceKey(text)) {
    throw new RangeError("a place key is a JSON array");
  }
  return text;
}

function endOf(range: LineRange): number {
  return range.start + range.len;
}

function spotsOf<P extends string>(
  file: SearchedFile<P>,
  pane: P,
  { lead }: Layout<P>,
): (line: number) => Spot {
  let passed = 0;
  return (line) => {
    let next = file.changes[passed];
    while (next !== undefined && endOf(next[pane]) <= line) {
      passed += 1;
      next = file.changes[passed];
    }
    if (next !== undefined && next[pane].start <= line) {
      return { kind: "in", change: passed, leadStart: next[lead].start };
    }
    const last = file.changes[passed - 1];
    const aligned = last === undefined ? line : line - endOf(last[pane]) + endOf(last[lead]);
    return { kind: "out", aligned };
  };
}

function groupsOf<P extends string>(
  file: SearchedFile<P>,
  matcher: Matcher,
  layout: Layout<P>,
  limit: number,
): { readonly groups: readonly Group<P>[]; readonly cut: boolean } {
  const groups = new Map<string, Group<P>>();
  const ordinals = new Map<string, number>();
  let cut = false;
  for (const pane of layout.panes) {
    const text = file.texts[pane];
    if (text === null) {
      continue;
    }
    const found = matcher.hits(text, limit);
    cut ||= found.cut;
    const spotOf = spotsOf(file, pane, layout);
    for (const hit of found.hits) {
      const spot = spotOf(hit.line);
      const where =
        spot.kind === "in" ? [spot.change, hit.lineDigest, hit.from] : [spot.aligned, hit.from];
      const counted = JSON.stringify([pane, where]);
      const ordinal = ordinals.get(counted) ?? 0;
      ordinals.set(counted, ordinal + 1);
      const key = JSON.stringify([where, ordinal]);
      const entry = { pane, hit, spot };
      const group = groups.get(key);
      if (group === undefined) {
        groups.set(key, [entry]);
      } else {
        group.push(entry);
      }
    }
  }
  return { groups: [...groups.values()], cut };
}

function orderOf<P extends string>(group: Group<P>, layout: Layout<P>): Order {
  const lead = group.find((found) => found.pane === layout.lead);
  if (lead !== undefined) {
    const { line, from } = lead.hit;
    return { anchor: line, phase: 1, paneRank: 0, line, from };
  }
  const [{ pane, hit, spot }] = group;
  if (spot.kind === "out") {
    return { anchor: spot.aligned, phase: 1, paneRank: 0, line: spot.aligned, from: hit.from };
  }
  const paneRank = layout.panes.indexOf(pane);
  return { anchor: spot.leadStart, phase: 0, paneRank, line: hit.line, from: hit.from };
}

function byOrder(a: Order, b: Order): number {
  for (const field of ORDER_FIELDS) {
    if (a[field] !== b[field]) {
      return a[field] - b[field];
    }
  }
  return 0;
}

function entryOf<P extends string>({ pane, hit: { line, from, to } }: Found<P>): PaneEntry<P> {
  return { pane, hit: { line, from, to } };
}

function placesOf<P extends string>(sorted: readonly Group<P>[], layout: Layout<P>): Place<P>[] {
  const ordinals = new Map<string, number>();
  return sorted.map((group) => {
    const [head, ...tail] = group;
    const { hit } = group.find((found) => found.pane === layout.lead) ?? head;
    const panes = group.map((found) => found.pane);
    const counted = JSON.stringify([panes, hit.from, hit.lineDigest]);
    const ordinal = ordinals.get(counted) ?? 0;
    ordinals.set(counted, ordinal + 1);
    return {
      key: placeKey([panes, hit.from, hit.lineDigest, ordinal]),
      hits: [entryOf(head), ...tail.map(entryOf)],
      preview: previewOf(hit),
    };
  });
}

export function filePlaces<P extends string>(
  file: SearchedFile<P>,
  matcher: Matcher,
  layout: Layout<P>,
  limit: number,
): { readonly places: readonly Place<P>[]; readonly cut: boolean } {
  const { groups, cut } = groupsOf(file, matcher, layout, limit);
  const sorted = groups
    .map((group) => ({ group, order: orderOf(group, layout) }))
    .sort((a, b) => byOrder(a.order, b.order))
    .map(({ group }) => group);
  return { places: placesOf(sorted, layout), cut };
}
