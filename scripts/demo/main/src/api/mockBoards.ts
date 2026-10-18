import { addCard, createBoard, setLimit } from "../board/board";
import type { Board } from "../board/types";

export function mockBoard(id: string): Board {
  const board = createBoard(id === "default" ? "Website relaunch" : id);
  const [todo, doing, review, done] = board.columns;
  if (
    todo === undefined ||
    doing === undefined ||
    review === undefined ||
    done === undefined
  ) {
    return board;
  }
  setLimit(board, doing.id, 3);

  addCard(board, todo.id, {
    title: "Write the pricing page copy",
    assignee: "Maya Lindqvist",
    dueDate: "2026-10-24",
  });
  addCard(board, todo.id, {
    title: "Pick photos for the team page",
    labels: [{ name: "design", color: "purple" }],
  });
  addCard(board, doing.id, {
    title: "Move the blog to the new templates",
    labels: [{ name: "frontend", color: "blue" }],
    assignee: "Tomás Herrera",
  });
  addCard(board, doing.id, {
    title: "Redirects for the old URLs",
    assignee: "Tomás Herrera",
    dueDate: "2026-10-20",
  });
  addCard(board, doing.id, {
    title: "Newsletter sign-up form",
    labels: [{ name: "frontend", color: "blue" }],
    assignee: "Maya Lindqvist",
  });
  addCard(board, review.id, {
    title: "Cookie banner",
    labels: [{ name: "legal", color: "orange" }],
    assignee: "Priya Nair",
    dueDate: "2026-10-19",
  });
  addCard(board, done.id, {
    title: "New logo",
    labels: [{ name: "design", color: "purple" }],
    assignee: "Priya Nair",
  });
  return board;
}
