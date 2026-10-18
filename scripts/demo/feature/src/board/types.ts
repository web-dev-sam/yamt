export type CardId = string;
export type ColumnId = string;

export type LabelColor = "grey" | "red" | "orange" | "green" | "blue" | "purple";

export type Label = {
  name: string;
  color: LabelColor;
};

export type Card = {
  id: CardId;
  title: string;
  description: string;
  labels: Label[];
  assignee?: string;
  /** When the card is due, as an ISO date-time (`2026-10-24T17:00:00Z`). */
  dueAt?: string;
  /** Minutes before `dueAt` to remind the assignee. */
  remindBefore?: number;
  createdAt: string;
  archived: boolean;
};

export type Column = {
  id: ColumnId;
  name: string;
  cardIds: CardId[];
  /** The most cards the column takes (work in progress); none when unset. */
  limit?: number;
};

export type Board = {
  id: string;
  name: string;
  columns: Column[];
  cards: Record<CardId, Card>;
};
