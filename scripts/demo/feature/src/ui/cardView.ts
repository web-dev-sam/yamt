import { cardSummary } from "../board/card";
import type { Card, Label } from "../board/types";

export function renderCard(card: Card): HTMLElement {
  const element = document.createElement("article");
  element.className = "card";
  element.dataset.cardId = card.id;
  element.title = cardSummary(card);

  const title = document.createElement("h3");
  title.textContent = card.title;
  element.append(title);

  if (card.labels.length > 0) {
    element.append(renderLabels(card.labels));
  }
  if (card.dueAt !== undefined) {
    element.append(badge(`Due ${new Date(card.dueAt).toLocaleString()}`, "due"));
  }
  if (card.remindBefore !== undefined) {
    element.append(badge(`Reminder ${card.remindBefore} min before`, "reminder"));
  }
  return element;
}

function renderLabels(labels: Label[]): HTMLElement {
  const list = document.createElement("ul");
  list.className = "labels";
  for (const label of labels) {
    const item = document.createElement("li");
    item.className = `label label-${label.color}`;
    item.textContent = label.name;
    list.append(item);
  }
  return list;
}

function badge(text: string, kind: string): HTMLElement {
  const element = document.createElement("span");
  element.className = `badge badge-${kind}`;
  element.textContent = text;
  return element;
}
