export type Align = "none" | "left" | "center" | "right";

export type Table = {
  readonly kind: "table";
  readonly align: readonly Align[];
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
};

const DELIMITER_CELL = /^:?-+:?$/;
const ALIGN: Readonly<Record<string, Align>> = { "::": "center", ":-": "left", "-:": "right" };
const LEADING_PIPE = /^\|/;
const TRAILING_PIPE = /(?<!\\)\|$/;
const CELL_PIPE = /(?<!\\)\|/;

function cells(line: string): string[] {
  const inner = line.trim().replace(LEADING_PIPE, "").replace(TRAILING_PIPE, "");
  return inner.split(CELL_PIPE).map((cell) => cell.trim());
}

function delimiterRow(line: string, columns: number): Align[] | null {
  const row = cells(line);
  if (
    !line.includes("|") ||
    row.length !== columns ||
    !row.every((cell) => DELIMITER_CELL.test(cell))
  ) {
    return null;
  }
  return row.map((cell) => ALIGN[`${cell.at(0)}${cell.at(-1)}`] ?? "none");
}

export function startsTable(header: string, delimiter: string): boolean {
  return header.includes("|") && delimiterRow(delimiter, cells(header).length) !== null;
}

export function tableOf(lines: readonly string[]): Table {
  const [headerLine = "", delimiterLine = "", ...rowLines] = lines;
  const header = cells(headerLine);
  const align = delimiterRow(delimiterLine, header.length) ?? [];
  const rows = rowLines.map((line) => {
    const row = cells(line);
    return header.map((_, column) => row[column] ?? "");
  });
  return { kind: "table", align, header, rows };
}
