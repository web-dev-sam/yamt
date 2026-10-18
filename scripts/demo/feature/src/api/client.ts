import { fromJSON, toJSON } from "../board/storage";
import type { Board } from "../board/types";

const API_URL = "/api/boards";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function loadBoard(id: string): Promise<Board> {
  const response = await fetch(`${API_URL}/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new ApiError(
      `Could not load board ${id}: ${response.statusText}`,
      response.status,
    );
  }
  return fromJSON(await response.text());
}

export async function saveBoard(board: Board): Promise<void> {
  const response = await fetch(`${API_URL}/${encodeURIComponent(board.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: toJSON(board),
  });
  if (!response.ok) {
    throw new ApiError(
      `Could not save board ${board.id}: ${response.statusText}`,
      response.status,
    );
  }
}

export async function copyBoard(board: Board, name: string): Promise<Board> {
  const response = await fetch(
    `${API_URL}/${encodeURIComponent(board.id)}/copy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  if (!response.ok) {
    throw new ApiError(
      `Could not copy board ${board.id}: ${response.statusText}`,
      response.status,
    );
  }
  return fromJSON(await response.text());
}
