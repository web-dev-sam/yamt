import type { Layout, PaneEntry, Place } from "./places";
import type { FileGroup, SearchResults } from "./results";

export type ListRow<P extends string> =
  | {
      readonly kind: "group";
      readonly path: string;
      readonly count: number;
      readonly open: boolean;
    }
  | {
      readonly kind: "place";
      readonly path: string;
      readonly place: Place<P>;
      readonly shown: readonly [PaneEntry<P>, ...PaneEntry<P>[]];
    };
export type Summary =
  | { readonly kind: "searching" }
  | { readonly kind: "noResults" }
  | { readonly kind: "filteredOut" }
  | {
      readonly kind: "results";
      readonly rows: number;
      readonly files: number;
      readonly cut: boolean;
    };

type ShownPlace<P extends string> = {
  readonly place: Place<P>;
  readonly shown: readonly [PaneEntry<P>, ...PaneEntry<P>[]];
};

type ShownGroup<P extends string> = {
  readonly path: string;
  readonly places: readonly ShownPlace<P>[];
};

function shownHits<P extends string>(place: Place<P>, on: ReadonlySet<P>): PaneEntry<P>[] {
  return place.hits.filter((entry) => on.has(entry.pane));
}

function shownPlaces<P extends string>(group: FileGroup<P>, on: ReadonlySet<P>): ShownPlace<P>[] {
  return group.places.flatMap((place) => {
    if (group.dismissed.has(place.key)) {
      return [];
    }
    const [first, ...rest] = shownHits(place, on);
    return first === undefined ? [] : [{ place, shown: [first, ...rest] }];
  });
}

function shownGroups<P extends string>(
  results: SearchResults<P>,
  on: ReadonlySet<P>,
): ShownGroup<P>[] {
  return results.groups.flatMap((group) => {
    if (results.dismissedFiles.has(group.path)) {
      return [];
    }
    const places = shownPlaces(group, on);
    return places.length === 0 ? [] : [{ path: group.path, places }];
  });
}

export function listRows<P extends string>(
  results: SearchResults<P>,
  on: ReadonlySet<P>,
  closed: ReadonlySet<string>,
): readonly ListRow<P>[] {
  return shownGroups(results, on).flatMap(({ path, places }): ListRow<P>[] => {
    const open = !closed.has(path);
    const header: ListRow<P> = { kind: "group", path, count: places.length, open };
    if (!open) {
      return [header];
    }
    return [
      header,
      ...places.map(({ place, shown }): ListRow<P> => ({ kind: "place", path, place, shown })),
    ];
  });
}

export function summaryOf<P extends string>(
  results: SearchResults<P> | null,
  on: ReadonlySet<P>,
  running: boolean,
): Summary | null {
  if (results === null && !running) {
    return null;
  }
  if (on.size === 0) {
    return { kind: "filteredOut" };
  }
  if (results === null) {
    return { kind: "searching" };
  }
  const groups = shownGroups(results, on);
  if (groups.length === 0) {
    return running ? { kind: "searching" } : { kind: "noResults" };
  }
  const rows = groups.reduce((sum, group) => sum + group.places.length, 0);
  return { kind: "results", rows, files: groups.length, cut: results.cut };
}

export function goToPane<P extends string>(
  place: Place<P>,
  on: ReadonlySet<P>,
  layout: Layout<P>,
): PaneEntry<P> | null {
  const shown = shownHits(place, on);
  return shown.find((entry) => entry.pane === layout.lead) ?? shown[0] ?? null;
}
