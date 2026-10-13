import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readState, statePath, type AppState, type SessionState } from "./state";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

export function fromRoot(path: string): string {
  return resolve(REPO_ROOT, path);
}

export function displayEnv(display: number): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, DISPLAY: `:${display}`, GDK_BACKEND: "x11" };
  delete env["WAYLAND_DISPLAY"];
  return env;
}

export function sessionNamed(name: string): SessionState {
  const state = readState(statePath(name));
  if (state === null) {
    throw new Error(`no session named "${name}"; run start-app or start-fixture first`);
  }
  return state;
}

export function appSession(state: SessionState, command: string): AppState {
  if (state.kind !== "app") {
    throw new Error(
      `${command} needs the private display of a start-app session; "${state.name}" is a fixture session`,
    );
  }
  return state;
}
