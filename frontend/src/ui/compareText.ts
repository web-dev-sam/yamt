import type { Column, TabEntry, TabId } from "../ipc";
import type { NoticeRow } from "./noticeText";

export type CompareNotice =
  | {
      readonly kind: "format";
      readonly tab: TabId;
      readonly name: string;
      readonly column: Column;
      readonly language: string;
      readonly message: string;
      readonly line: number;
    }
  | {
      readonly kind: "refused";
      readonly tab: TabId;
      readonly name: string;
      readonly column: Column;
      readonly limit: number;
    };

const BYTES_PER_MIB = 1_048_576;

export function columnLimitText(limit: number): string {
  return `a column holds up to ${limit / BYTES_PER_MIB} MiB`;
}

function what(notice: CompareNotice): string {
  switch (notice.kind) {
    case "format":
      return `not valid ${notice.language} (line ${notice.line}): ${notice.message}`;
    case "refused":
      return `not pasted — ${columnLimitText(notice.limit)}`;
    default: {
      const _exhaustive: never = notice;
      return _exhaustive;
    }
  }
}

export function compareNoticeRow(notice: CompareNotice): NoticeRow {
  const where = `${notice.name}, ${notice.column}`;
  return {
    key: `${notice.tab}:${notice.column}`,
    text: `${where}: ${what(notice)}`,
    closeLabel: `Close the notice about ${where}`,
  };
}

export function tabName(tabs: readonly TabEntry[], tab: TabId): string {
  return tabs.find((entry) => entry.id === tab)?.name ?? `Tab ${tab}`;
}
