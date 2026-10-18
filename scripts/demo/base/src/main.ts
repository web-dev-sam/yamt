import "./styles.css";

import { loadBoard } from "./api/client";
import { cardsIn } from "./board/board";
import { renderCard } from "./ui/cardView";

async function start(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (root === null) {
    throw new Error("index.html has no #app element");
  }
  const boardId =
    new URLSearchParams(location.search).get("board") ?? "default";
  const board = await loadBoard(boardId);
  document.title = `${board.name} · Taskboard`;

  for (const column of board.columns) {
    const section = document.createElement("section");
    section.className = "column";
    const heading = document.createElement("h2");
    heading.textContent = column.name;
    section.append(heading, ...cardsIn(board, column.id).map(renderCard));
    root.append(section);
  }
}

void start();
