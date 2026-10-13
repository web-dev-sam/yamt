import { rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { isOwnTempFolder } from "./folders";
import { stopProc } from "./processes";
import { readState, statePath, type SessionState } from "./state";
import { deleteSession } from "./webdriver";

async function endSession(state: SessionState): Promise<string> {
  if (state.session === null) {
    return "none";
  }
  try {
    await deleteSession(state.driverPort, state.session);
    return "ended";
  } catch (error) {
    return `not ended: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function stopSession(state: SessionState): Promise<Readonly<Record<string, unknown>>> {
  const session = await endSession(state);
  const procs = [];
  for (const proc of state.procs.toReversed()) {
    procs.push({ role: proc.role, pid: proc.pid, result: await stopProc(proc) });
  }
  const ownFolder = isOwnTempFolder(state.folder, tmpdir());
  if (ownFolder) {
    rmSync(state.folder, { recursive: true, force: true });
  }
  rmSync(statePath(state.name), { force: true });
  return {
    stopped: state.name,
    session,
    procs,
    folder: ownFolder
      ? `removed ${state.folder}`
      : `kept ${state.folder} (not this tool's temp folder)`,
  };
}

export async function stopNamed(name: string): Promise<Readonly<Record<string, unknown>>> {
  const state = readState(statePath(name));
  return state === null
    ? { note: `no session named "${name}"; nothing to stop` }
    : stopSession(state);
}
