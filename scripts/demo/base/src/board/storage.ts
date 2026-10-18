import type { Board, Card, Column, Label, LabelColor } from "./types";

export const FORMAT_VERSION = 2;

const LABEL_COLORS: LabelColor[] = ["grey", "red", "orange", "green", "blue", "purple"];

type Stored = { version: number; board: Board };

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export function toJSON(board: Board): string {
  const stored: Stored = { version: FORMAT_VERSION, board };
  return JSON.stringify(stored);
}

export function fromJSON(text: string): Board {
  const data: unknown = JSON.parse(text);
  if (!isRecord(data)) {
    throw new StorageError("A stored board is a JSON object");
  }
  if (data.version !== FORMAT_VERSION) {
    throw new StorageError(`Board format ${String(data.version)} is not supported`);
  }
  return readBoard(data.board);
}

function readBoard(value: unknown): Board {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    throw new StorageError("A board needs an id and a name");
  }
  if (!Array.isArray(value.columns) || !isRecord(value.cards)) {
    throw new StorageError(`Board ${value.id} has no columns or cards`);
  }
  const cards: Record<string, Card> = {};
  for (const card of Object.values(value.cards).map(readCard)) {
    cards[card.id] = card;
  }
  return { id: value.id, name: value.name, columns: value.columns.map(readColumn), cards };
}

function readColumn(value: unknown): Column {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    throw new StorageError("A column needs an id and a name");
  }
  const cardIds = Array.isArray(value.cardIds) ? value.cardIds.filter(isString) : [];
  const limit = typeof value.limit === "number" ? value.limit : undefined;
  return { id: value.id, name: value.name, cardIds, limit };
}

function readCard(value: unknown): Card {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    throw new StorageError("A card needs an id and a title");
  }
  return {
    id: value.id,
    title: value.title,
    description: typeof value.description === "string" ? value.description : "",
    labels: Array.isArray(value.labels) ? value.labels.filter(isLabel) : [],
    assignee: typeof value.assignee === "string" ? value.assignee : undefined,
    dueDate: typeof value.dueDate === "string" ? value.dueDate : undefined,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    archived: value.archived === true,
  };
}

function isLabel(value: unknown): value is Label {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    LABEL_COLORS.some((color) => color === value.color)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
