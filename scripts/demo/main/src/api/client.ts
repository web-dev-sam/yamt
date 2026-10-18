import { fromJSON, toJSON } from "../board/storage";
import type { Board } from "../board/types";
import { mockBoard } from "./mockBoards";

const API_URL = "/api/boards";
const useMocks =
  location.hostname === "localhost" || new URLSearchParams(location.search).has("mocks");

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
  if (useMocks) {
    return mockBoard(id);
  }
  const response = await fetch(`${API_URL}/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new ApiError(`Could not load board ${id}: ${response.statusText}`, response.status);
  }
  return fromJSON(await response.text());
}

export async function saveBoard(board: Board): Promise<void> {
  if (useMocks) {
    return;
  }
  const response = await fetch(`${API_URL}/${encodeURIComponent(board.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: toJSON(board),
  });
  if (!response.ok) {
    throw new ApiError(`Could not save board ${board.id}: ${response.statusText}`, response.status);
  }
}
