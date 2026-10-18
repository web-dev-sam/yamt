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
  /** A day, as `YYYY-MM-DD`. */
  dueDate?: string;
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
