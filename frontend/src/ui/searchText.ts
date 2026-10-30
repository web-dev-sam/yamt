import type { Summary } from "../search";
import { counted } from "./serverText";

export const SEARCH_TITLE = "Search";
export const SEARCH_PLACEHOLDER = "Search";
export const MATCH_CASE_LABEL = "Match case";
export const PANE_FILTERS_LABEL = "Panes searched";
export const RESULTS_LABEL = "Search results";
export const DISMISS_LABEL = "Dismiss";

export const CUT_TEXT =
  "The result set only contains a subset of all matches. Be more specific in your search to narrow down the results.";

export function summaryText(summary: Summary): string {
  switch (summary.kind) {
    case "searching":
      return "Searching…";
    case "noResults":
      return "No results found.";
    case "filteredOut":
      return "Every pane is filtered out.";
    case "results":
      return `${counted(summary.rows, "result", "results")} in ${counted(summary.files, "file", "files")}`;
  }
}

export function paneHitTitle(title: string, line: number): string {
  return `${title}, line ${line + 1}`;
}
