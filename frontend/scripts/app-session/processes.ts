import { execFile, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { closeSync, openSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

import { parseStartTicks, type Proc, type Save, type SessionState } from "./state";

const POLL_MS = 100;
const STOP_GRACE_MS = 3000;
const OWNER_DEV_PORT = 5173;
const RUN_TIMEOUT_MS = 30_000;
const PROCESS_ID = /^[0-9]+$/;
const APP_COMMAND = "yamt";

export type Launch = {
  readonly role: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly cwd: string;
  readonly logDir: string;
  readonly fd3File: string | null;
};

export function logFile(logDir: string, role: string): string {
  return join(logDir, `${role}.log`);
}

function startTicksOf(pid: number): number | null {
  try {
    return parseStartTicks(readFileSync(`/proc/${pid}/stat`, "utf8"));
  } catch {
    return null;
  }
}

async function launch(spec: Launch): Promise<{ child: ChildProcess; proc: Proc }> {
  const log = openSync(logFile(spec.logDir, spec.role), "a");
  const extra = spec.fd3File === null ? [] : [openSync(spec.fd3File, "w")];
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: spec.env,
    detached: true,
    stdio: ["ignore", log, log, ...extra],
  });
  for (const fd of [log, ...extra]) {
    closeSync(fd);
  }
  await once(child, "spawn");
  child.unref();
  const pid = child.pid;
  const startTicks = pid === undefined ? null : startTicksOf(pid);
  if (pid === undefined || startTicks === null) {
    throw new Error(`${spec.command} exited at once; see ${logFile(spec.logDir, spec.role)}`);
  }
  return { child, proc: { role: spec.role, pid, startTicks } };
}

/** Launches a process and records it in the session's state at once, so `stop` always finds it. */
export async function launchTracked<S extends SessionState>(
  state: S,
  spec: Launch,
  save: Save<S>,
): Promise<{ state: S; child: ChildProcess }> {
  const { child, proc } = await launch(spec);
  return { state: save({ ...state, procs: [...state.procs, proc] }), child };
}

export async function waitUntil(
  check: () => boolean | Promise<boolean>,
  timeoutMs: number,
  what: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) {
      throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}`);
    }
    await sleep(POLL_MS);
  }
}

export async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  await once(server, "close");
  if (typeof address !== "object" || address === null) {
    throw new Error("no free port");
  }
  return address.port === OWNER_DEV_PORT ? freePort() : address.port;
}

function signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    return false;
  }
}

export type StopResult = "stopped" | "killed" | "gone" | "not ours";

export async function stopProc(proc: Proc): Promise<StopResult> {
  const ticks = startTicksOf(proc.pid);
  if (ticks !== null && ticks !== proc.startTicks) {
    return "not ours";
  }
  if (!signalGroup(proc.pid, "SIGTERM")) {
    return "gone";
  }
  try {
    await waitUntil(() => !signalGroup(proc.pid, 0), STOP_GRACE_MS, `${proc.role} to stop`);
    return "stopped";
  } catch {
    signalGroup(proc.pid, "SIGKILL");
    return "killed";
  }
}

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function holdsEntry(environ: string, entry: string): boolean {
  return environ.split("\0").includes(entry);
}

export function runningAppsWith(entry: string): Proc[] {
  return readdirSync("/proc")
    .filter((name) => PROCESS_ID.test(name))
    .flatMap((name) => {
      const pid = Number(name);
      const environ = readOrNull(`/proc/${name}/environ`);
      const startTicks = startTicksOf(pid);
      const isApp = readOrNull(`/proc/${name}/comm`)?.trim() === APP_COMMAND;
      return isApp && environ !== null && startTicks !== null && holdsEntry(environ, entry)
        ? [{ role: "yamt child", pid, startTicks }]
        : [];
    });
}

const execFileText = promisify(execFile);

export async function run(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<string> {
  try {
    const { stdout } = await execFileText(command, args, {
      env,
      encoding: "utf8",
      timeout: RUN_TIMEOUT_MS,
    });
    return stdout;
  } catch (error) {
    const stderr = error instanceof Error && "stderr" in error ? String(error.stderr) : "";
    throw new Error(`${command} ${args.join(" ")} failed: ${stderr.trim()}`, { cause: error });
  }
}
