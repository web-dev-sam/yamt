import type { Query } from "./match";
import type { Place, PlaceKey } from "./places";

export type FileGroup<P extends string> = {
  readonly path: string;
  readonly rank: number;
  readonly places: readonly Place<P>[];
  readonly dismissed: ReadonlySet<PlaceKey>;
};
export type SearchResults<P extends string> = {
  readonly query: Query;
  readonly groups: readonly FileGroup<P>[];
  readonly dismissedFiles: ReadonlySet<string>;
  readonly found: number;
  readonly cut: boolean;
};

export const MAX_ROWS = 20_000;

export function emptyResults<P extends string>(query: Query): SearchResults<P> {
  return { query, groups: [], dismissedFiles: new Set(), found: 0, cut: false };
}

function stillAmong<P extends string>(
  dismissed: ReadonlySet<PlaceKey>,
  places: readonly Place<P>[],
): ReadonlySet<PlaceKey> {
  return new Set(places.flatMap(({ key }) => (dismissed.has(key) ? [key] : [])));
}

function capped<P extends string>(
  results: SearchResults<P>,
  groups: readonly FileGroup<P>[],
  cut: boolean,
): SearchResults<P> {
  const kept: FileGroup<P>[] = [];
  let room = MAX_ROWS;
  let wasCut = cut;
  for (const group of groups) {
    if (group.places.length > room) {
      const places = group.places.slice(0, room);
      if (places.length > 0) {
        kept.push({ ...group, places, dismissed: stillAmong(group.dismissed, places) });
      }
      room = 0;
      wasCut = true;
      break;
    }
    kept.push(group);
    room -= group.places.length;
  }
  return { ...results, groups: kept, found: MAX_ROWS - room, cut: wasCut };
}

export function withFile<P extends string>(
  results: SearchResults<P>,
  file: {
    readonly path: string;
    readonly rank: number;
    readonly places: readonly Place<P>[];
    readonly cut: boolean;
  },
): SearchResults<P> {
  const others = results.groups.filter((group) => group.path !== file.path);
  const before = results.groups.find((group) => group.path === file.path);
  const added: FileGroup<P>[] =
    file.places.length === 0
      ? []
      : [
          {
            path: file.path,
            rank: file.rank,
            places: file.places,
            dismissed: before === undefined ? new Set() : stillAmong(before.dismissed, file.places),
          },
        ];
  const after = others.findIndex((other) => other.rank > file.rank);
  const groups = others.toSpliced(after === -1 ? others.length : after, 0, ...added);
  return capped(results, groups, results.cut || file.cut);
}

export function dismissPlace<P extends string>(
  results: SearchResults<P>,
  path: string,
  key: PlaceKey,
): SearchResults<P> {
  const groups = results.groups.map((group) =>
    group.path === path && group.places.some((place) => place.key === key)
      ? { ...group, dismissed: new Set([...group.dismissed, key]) }
      : group,
  );
  return { ...results, groups };
}

export function dismissFile<P extends string>(
  results: SearchResults<P>,
  path: string,
): SearchResults<P> {
  if (!results.groups.some((group) => group.path === path)) {
    return results;
  }
  return { ...results, dismissedFiles: new Set([...results.dismissedFiles, path]) };
}
