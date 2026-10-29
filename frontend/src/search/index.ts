export { matcherOf, type Matcher, type Query } from "./internal/match";
export {
  filePlaces,
  type Layout,
  type LineRange,
  type PaneEntry,
  type PaneHit,
  type Place,
  type PlaceKey,
  type SearchedFile,
} from "./internal/places";
export type { Preview } from "./internal/preview";
export {
  MAX_ROWS,
  dismissFile,
  dismissPlace,
  emptyResults,
  withFile,
  type FileGroup,
  type SearchResults,
} from "./internal/results";
export { goToPane, listRows, summaryOf, type ListRow, type Summary } from "./internal/list";
