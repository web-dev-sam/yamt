import type * as Generated from "./bindings";
import {
  isColumnVersion,
  isLeftLine,
  isRightLine,
  isTabId,
  toRange,
  type ColumnVersion,
  type LeftLine,
  type LineRange,
  type RightLine,
  type TabId,
} from "./domain";
import { invalid, isNonNegativeInteger } from "./validate";
import { toSideWords, type SideWords } from "./words";

export type Column = Generated.Column;
export type TabLanguage = Readonly<Generated.TabLanguage>;
export type TabEntry = {
  readonly id: TabId;
  readonly name: string;
  readonly language: TabLanguage;
  readonly holdsText: boolean;
};
export type TabList = { readonly tabs: readonly TabEntry[]; readonly shown: TabId };
export type CompareStart = { readonly list: TabList; readonly columnLimit: number };
export type ColumnVersions = Readonly<Record<Column, ColumnVersion>>;
export type Difference = {
  readonly left: LineRange<LeftLine>;
  readonly right: LineRange<RightLine>;
  readonly words: { readonly left: SideWords<LeftLine>; readonly right: SideWords<RightLine> };
};
export type Comparison = {
  readonly versions: ColumnVersions;
  readonly differences: readonly Difference[];
};
export type TabTexts = {
  readonly left: string;
  readonly right: string;
  readonly comparison: Comparison;
};
export type ColumnWrite = {
  readonly tab: TabId;
  readonly column: Column;
  readonly text: string;
  readonly version: ColumnVersion;
};

function toTabId(n: number, field: string): TabId {
  if (!isTabId(n)) {
    throw invalid(field, n);
  }
  return n;
}

function toColumnVersion(n: number, field: string): ColumnVersion {
  if (!isColumnVersion(n)) {
    throw invalid(field, n);
  }
  return n;
}

export function toTabList(dto: Generated.TabList): TabList {
  return {
    tabs: dto.tabs.map(({ id, name, language, holds_text: holdsText }, index) => ({
      id: toTabId(id, `tabs[${index}].id`),
      name,
      language,
      holdsText,
    })),
    shown: toTabId(dto.shown, "shown"),
  };
}

export function toCompareStart(dto: Generated.CompareStart): CompareStart {
  const { column_limit: columnLimit } = dto;
  if (!isNonNegativeInteger(columnLimit)) {
    throw invalid("column_limit", columnLimit);
  }
  return { list: toTabList(dto.list), columnLimit };
}

export function toColumnVersions(dto: Generated.ColumnVersions): ColumnVersions {
  return {
    left: toColumnVersion(dto.left, "versions.left"),
    right: toColumnVersion(dto.right, "versions.right"),
  };
}

export function toDifferences(dtos: readonly Generated.Difference[]): Difference[] {
  return dtos.map(({ left, right, words }, index) => {
    const field = `differences[${index}]`;
    return {
      left: toRange({ range: left, isLine: isLeftLine, field: `${field}.left` }),
      right: toRange({ range: right, isLine: isRightLine, field: `${field}.right` }),
      words: {
        left: toSideWords({ side: words.left, isLine: isLeftLine, field: `${field}.words.left` }),
        right: toSideWords({
          side: words.right,
          isLine: isRightLine,
          field: `${field}.words.right`,
        }),
      },
    };
  });
}

export function toComparison(dto: Generated.Comparison): Comparison {
  return { versions: toColumnVersions(dto.versions), differences: toDifferences(dto.differences) };
}

export function toTabTexts(dto: Generated.TabTexts): TabTexts {
  return { left: dto.left, right: dto.right, comparison: toComparison(dto.comparison) };
}
