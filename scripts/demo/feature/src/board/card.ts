import type { Card, Label } from "./types";

export type NewCard = {
  title: string;
  description?: string;
  labels?: Label[];
  assignee?: string;
  dueAt?: string;
  remindBefore?: number;
};

const MAX_TITLE_LENGTH = 200;

export function createCard(input: NewCard, now = new Date()): Card {
  const title = input.title.trim();
  if (title === "") {
    throw new Error("A card needs a title");
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`A card title has at most ${MAX_TITLE_LENGTH} characters`);
  }
  return {
    id: crypto.randomUUID(),
    title,
    description: input.description?.trim() ?? "",
    labels: input.labels ?? [],
    assignee: input.assignee,
    dueAt: input.dueAt,
    remindBefore: input.remindBefore,
    createdAt: now.toISOString(),
    archived: false,
  };
}

export function hasLabel(card: Card, name: string): boolean {
  return card.labels.some((label) => label.name === name);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== "")
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

export function cardSummary(card: Card): string {
  const parts = [card.title];
  if (card.assignee !== undefined) {
    parts.push(`@${card.assignee}`);
  }
  if (card.dueAt !== undefined) {
    parts.push(`due ${new Date(card.dueAt).toLocaleString()}`);
  }
  return parts.join(" · ");
}
