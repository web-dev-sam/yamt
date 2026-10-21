import type { ShallowRef } from "vue";

import type { Column, TabEntry, TabId } from "../ipc";
import { compareNoticeRow, tabName, type CompareNotice } from "./compareText";
import type { NoticeRow } from "./noticeText";

export type ColumnFormatFailure = {
  readonly column: Column;
  readonly language: string;
  readonly message: string;
  readonly line: number;
};

export type ShownNotice = NoticeRow & { readonly notice: CompareNotice };

type NoticeTarget = {
  readonly notices: ShallowRef<readonly ShownNotice[]>;
  readonly tabs: Readonly<ShallowRef<readonly TabEntry[]>>;
  readonly columnLimit: Readonly<ShallowRef<number>>;
};

export type CompareNotices = {
  /** The outcome of one Format on `tab`: called after every Format, with an empty list when it succeeded. */
  reportFormat(tab: TabId, failures: readonly ColumnFormatFailure[]): void;
  refused(tab: TabId, column: Column): void;
  dismissNotice(key: string): void;
};

function withNotice(shown: readonly ShownNotice[], notice: CompareNotice): ShownNotice[] {
  const row = { ...compareNoticeRow(notice), notice };
  return [...shown.filter((each) => each.key !== row.key), row];
}

export function createCompareNotices(target: NoticeTarget): CompareNotices {
  return {
    reportFormat: (tab, failures) => {
      const name = tabName(target.tabs.value, tab);
      target.notices.value = failures.reduce(
        (shown, failure) => withNotice(shown, { kind: "format", tab, name, ...failure }),
        target.notices.value.filter(({ notice }) => notice.kind !== "format" || notice.tab !== tab),
      );
    },
    refused: (tab, column) => {
      const name = tabName(target.tabs.value, tab);
      const limit = target.columnLimit.value;
      target.notices.value = withNotice(target.notices.value, {
        kind: "refused",
        tab,
        name,
        column,
        limit,
      });
    },
    dismissNotice: (key) => {
      target.notices.value = target.notices.value.filter((row) => row.key !== key);
    },
  };
}
