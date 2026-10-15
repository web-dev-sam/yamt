import type * as Generated from "./bindings";
import { invalid, isNonNegativeInteger } from "./validate";

type InlineRange<L> = { readonly line: L; readonly start: number; readonly len: number };
type InlinePoint<L> = { readonly line: L; readonly column: number };
type Removal<L> = { readonly at: InlinePoint<L>; readonly text: string };
export type SideWords<L> = {
  readonly changed: readonly InlineRange<L>[];
  readonly removals: readonly Removal<L>[];
};

function toInlineRange<L extends number>({
  range,
  isLine,
  field,
}: {
  range: Generated.InlineRange<number>;
  isLine: (n: number) => n is L;
  field: string;
}): InlineRange<L> {
  const { line, start, len } = range;
  if (!isLine(line)) {
    throw invalid(`${field}.line`, line);
  }
  if (!isNonNegativeInteger(start)) {
    throw invalid(`${field}.start`, start);
  }
  if (!Number.isSafeInteger(len) || len <= 0) {
    throw new Error(`${field}.len must be a positive safe integer, got ${len}`);
  }
  return { line, start, len };
}

function toInlinePoint<L extends number>({
  point,
  isLine,
  field,
}: {
  point: Generated.InlinePoint<number>;
  isLine: (n: number) => n is L;
  field: string;
}): InlinePoint<L> {
  const { line, column } = point;
  if (!isLine(line)) {
    throw invalid(`${field}.line`, line);
  }
  if (!isNonNegativeInteger(column)) {
    throw invalid(`${field}.column`, column);
  }
  return { line, column };
}

export function toSideWords<L extends number>({
  side,
  isLine,
  field,
}: {
  side: Generated.SideWordChanges<number>;
  isLine: (n: number) => n is L;
  field: string;
}): SideWords<L> {
  return {
    changed: side.changed.map((range, index) =>
      toInlineRange({ range, isLine, field: `${field}.changed[${index}]` }),
    ),
    removals: side.removals.map(({ at, text }, index) => {
      const removal = `${field}.removals[${index}]`;
      if (text === "") {
        throw new Error(`${removal}.text must not be empty`);
      }
      return { at: toInlinePoint({ point: at, isLine, field: `${removal}.at` }), text };
    }),
  };
}
