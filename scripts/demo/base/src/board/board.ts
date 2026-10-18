import { createCard, hasLabel, type NewCard } from "./card";
import type { Board, Card, CardId, Column, ColumnId, Label } from "./types";

export const DONE_COLUMN = "Done";

const DEFAULT_COLUMNS = ["To do", "In progress", "Review", DONE_COLUMN];
const MAX_ACTIVITY = 200;

export class BoardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoardError";
  }
}

export type Activity =
  | { kind: "added"; cardId: CardId; columnId: ColumnId; at: string }
  | { kind: "moved"; cardId: CardId; from: ColumnId; to: ColumnId; at: string }
  | { kind: "archived"; cardId: CardId; at: string }
  | { kind: "restored"; cardId: CardId; at: string };

const activity = new WeakMap<Board, Activity[]>();
let nextColumnId = 1;

function newColumnId(): ColumnId {
  const id = `col-${nextColumnId}`;
  nextColumnId += 1;
  return id;
}

export function createBoard(name: string, columnNames: string[] = DEFAULT_COLUMNS): Board {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new BoardError("A board needs a name");
  }
  return {
    id: crypto.randomUUID(),
    name: trimmed,
    columns: columnNames.map((columnName) => ({
      id: newColumnId(),
      name: columnName,
      cardIds: [],
    })),
    cards: {},
  };
}

// Columns

export function addColumn(board: Board, name: string, position = board.columns.length): Column {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new BoardError("A column needs a name");
  }
  if (board.columns.some((column) => column.name === trimmed)) {
    throw new BoardError(`There is already a column called "${trimmed}"`);
  }
  const column: Column = { id: newColumnId(), name: trimmed, cardIds: [] };
  board.columns.splice(position, 0, column);
  return column;
}

export function renameColumn(board: Board, columnId: ColumnId, name: string): void {
  const column = findColumn(board, columnId);
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new BoardError("A column needs a name");
  }
  if (board.columns.some((other) => other.id !== columnId && other.name === trimmed)) {
    throw new BoardError(`There is already a column called "${trimmed}"`);
  }
  column.name = trimmed;
}

export function removeColumn(board: Board, columnId: ColumnId): Card[] {
  const column = findColumn(board, columnId);
  if (board.columns.length === 1) {
    throw new BoardError("A board needs at least one column");
  }
  const removed = column.cardIds.map((id) => findCard(board, id));
  for (const card of removed) {
    delete board.cards[card.id];
  }
  board.columns = board.columns.filter((other) => other.id !== columnId);
  return removed;
}

export function setLimit(board: Board, columnId: ColumnId, limit: number | undefined): void {
  const column = findColumn(board, columnId);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new BoardError("A limit is a whole number of cards, at least 1");
  }
  column.limit = limit;
}

export function isFull(column: Column): boolean {
  return column.limit !== undefined && column.cardIds.length >= column.limit;
}

// Lookups

export function findColumn(board: Board, columnId: ColumnId): Column {
  const column = board.columns.find((candidate) => candidate.id === columnId);
  if (column === undefined) {
    throw new BoardError(`No column with id ${columnId}`);
  }
  return column;
}

export function findCard(board: Board, cardId: CardId): Card {
  const card = board.cards[cardId];
  if (card === undefined) {
    throw new BoardError(`No card with id ${cardId}`);
  }
  return card;
}

export function columnOf(board: Board, cardId: CardId): Column {
  const column = board.columns.find((candidate) => candidate.cardIds.includes(cardId));
  if (column === undefined) {
    throw new BoardError(`Card ${cardId} is in no column`);
  }
  return column;
}

export function cardsIn(board: Board, columnId: ColumnId): Card[] {
  return findColumn(board, columnId)
    .cardIds.map((id) => findCard(board, id))
    .filter((card) => !card.archived);
}

// Cards

export function moveCard(board: Board, cardId: CardId, toColumnId: ColumnId, index?: number): void {
  const from = columnOf(board, cardId);
  const to = findColumn(board, toColumnId);
  if (from.id !== to.id && isFull(to)) {
    throw new BoardError(`"${to.name}" already holds ${to.limit} cards`);
  }
  from.cardIds = from.cardIds.filter((id) => id !== cardId);
  to.cardIds.splice(index ?? to.cardIds.length, 0, cardId);
  if (from.id !== to.id) {
    record(board, { kind: "moved", cardId, from: from.id, to: to.id, at: now() });
  }
}

export function addCard(board: Board, columnId: ColumnId, input: NewCard): Card {
  const column = findColumn(board, columnId);
  if (isFull(column)) {
    throw new BoardError(`"${column.name}" already holds ${column.limit} cards`);
  }
  const card = createCard(input, new Date());
  board.cards[card.id] = card;
  column.cardIds.push(card.id);
  record(board, { kind: "added", cardId: card.id, columnId, at: card.createdAt });
  return card;
}

export function reorderCard(board: Board, cardId: CardId, index: number): void {
  moveCard(board, cardId, columnOf(board, cardId).id, index);
}

export function sortColumn(board: Board, columnId: ColumnId, by: "title" | "created"): void {
  const column = findColumn(board, columnId);
  const cards = column.cardIds.map((id) => findCard(board, id));
  cards.sort((a, b) =>
    by === "title" ? a.title.localeCompare(b.title) : a.createdAt.localeCompare(b.createdAt),
  );
  column.cardIds = cards.map((card) => card.id);
}

export function editCard(
  board: Board,
  cardId: CardId,
  changes: Partial<Pick<Card, "title" | "description">>,
): void {
  const card = findCard(board, cardId);
  if (changes.title !== undefined) {
    const title = changes.title.trim();
    if (title === "") {
      throw new BoardError("A card needs a title");
    }
    card.title = title;
  }
  if (changes.description !== undefined) {
    card.description = changes.description.trim();
  }
}

export function archiveCard(board: Board, cardId: CardId): void {
  findCard(board, cardId).archived = true;
  record(board, { kind: "archived", cardId, at: now() });
}

export function restoreCard(board: Board, cardId: CardId): void {
  const card = findCard(board, cardId);
  if (!card.archived) {
    return;
  }
  card.archived = false;
  record(board, { kind: "restored", cardId, at: now() });
}

export function archivedCards(board: Board): Card[] {
  return Object.values(board.cards).filter((card) => card.archived);
}

export function emptyArchive(board: Board): number {
  const archived = archivedCards(board);
  for (const card of archived) {
    const column = columnOf(board, card.id);
    column.cardIds = column.cardIds.filter((id) => id !== card.id);
    delete board.cards[card.id];
  }
  return archived.length;
}

export function moveAll(board: Board, fromColumnId: ColumnId, toColumnId: ColumnId): number {
  const from = findColumn(board, fromColumnId);
  const to = findColumn(board, toColumnId);
  const moving = from.cardIds.filter((id) => !findCard(board, id).archived);
  if (to.limit !== undefined && to.cardIds.length + moving.length > to.limit) {
    throw new BoardError(`"${to.name}" has room for ${to.limit - to.cardIds.length} more cards`);
  }
  for (const cardId of moving) {
    moveCard(board, cardId, toColumnId);
  }
  return moving.length;
}

export function archiveColumn(board: Board, columnId: ColumnId): number {
  const cards = cardsIn(board, columnId);
  for (const card of cards) {
    archiveCard(board, card.id);
  }
  return cards.length;
}

export function duplicateBoard(board: Board, name: string): Board {
  const copy = createBoard(
    name,
    board.columns.map((column) => column.name),
  );
  for (const [index, column] of board.columns.entries()) {
    const target = copy.columns[index];
    if (target === undefined) {
      continue;
    }
    target.limit = column.limit;
    for (const card of cardsIn(board, column.id)) {
      addCard(copy, target.id, { ...card, labels: [...card.labels] });
    }
  }
  return copy;
}

// Labels and people

export function addLabel(board: Board, cardId: CardId, label: Label): void {
  const card = findCard(board, cardId);
  if (!hasLabel(card, label.name)) {
    card.labels.push(label);
  }
}

export function removeLabel(board: Board, cardId: CardId, name: string): void {
  const card = findCard(board, cardId);
  card.labels = card.labels.filter((label) => label.name !== name);
}

export function labelsInUse(board: Board): Label[] {
  const byName = new Map<string, Label>();
  for (const card of Object.values(board.cards)) {
    for (const label of card.labels) {
      byName.set(label.name, label);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function assign(board: Board, cardId: CardId, person: string | undefined): void {
  const card = findCard(board, cardId);
  const name = person?.trim();
  card.assignee = name === "" ? undefined : name;
}

export function people(board: Board): string[] {
  const names = new Set<string>();
  for (const card of Object.values(board.cards)) {
    if (card.assignee !== undefined && !card.archived) {
      names.add(card.assignee);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function workload(board: Board): Map<string, number> {
  const counts = new Map<string, number>();
  for (const column of board.columns) {
    if (column.name === DONE_COLUMN) {
      continue;
    }
    for (const card of cardsIn(board, column.id)) {
      if (card.assignee !== undefined) {
        counts.set(card.assignee, (counts.get(card.assignee) ?? 0) + 1);
      }
    }
  }
  return counts;
}

// Statistics

export type ColumnCount = { column: string; cards: number; limit?: number };

export function columnCounts(board: Board): ColumnCount[] {
  return board.columns.map((column) => ({
    column: column.name,
    cards: cardsIn(board, column.id).length,
    limit: column.limit,
  }));
}

export function overLimit(board: Board): Column[] {
  return board.columns.filter(
    (column) => column.limit !== undefined && cardsIn(board, column.id).length > column.limit,
  );
}

export function progress(board: Board): number {
  const cards = Object.values(board.cards).filter((card) => !card.archived);
  if (cards.length === 0) {
    return 0;
  }
  const done = board.columns.find((column) => column.name === DONE_COLUMN);
  const finished = done === undefined ? 0 : cardsIn(board, done.id).length;
  return Math.round((finished / cards.length) * 100);
}

// Search

export function searchCards(board: Board, query: string): Card[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return [];
  }
  return Object.values(board.cards).filter(
    (card) =>
      !card.archived &&
      (card.title.toLowerCase().includes(needle) ||
        card.description.toLowerCase().includes(needle) ||
        card.labels.some((label) => label.name.toLowerCase() === needle)),
  );
}

// Activity

function now(): string {
  return new Date().toISOString();
}

function record(board: Board, entry: Activity): void {
  const entries = activity.get(board) ?? [];
  entries.push(entry);
  if (entries.length > MAX_ACTIVITY) {
    entries.splice(0, entries.length - MAX_ACTIVITY);
  }
  activity.set(board, entries);
}

export function recentActivity(board: Board, count = 20): Activity[] {
  return (activity.get(board) ?? []).slice(-count).reverse();
}

export function describeActivity(board: Board, entry: Activity): string {
  const title = board.cards[entry.cardId]?.title ?? "A deleted card";
  switch (entry.kind) {
    case "added":
      return `${title} was added to ${columnName(board, entry.columnId)}`;
    case "moved":
      return `${title} moved from ${columnName(board, entry.from)} to ${columnName(board, entry.to)}`;
    case "archived":
      return `${title} was archived`;
    case "restored":
      return `${title} was restored`;
  }
}

function columnName(board: Board, columnId: ColumnId): string {
  return board.columns.find((column) => column.id === columnId)?.name ?? "a removed column";
}
