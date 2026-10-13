import { execFileSync, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";

import type { Command } from "./args";
import { ownerConfigClash, TEMP_PREFIX } from "./folders";
import { freePort, launch, waitUntil, type Launch } from "./processes";
import { displayEnv, fromRoot } from "./session";
import { readState, statePath, writeState, type AppState, type SessionState } from "./state";
import { stopSession } from "./stop";
import { finishRecording, recordingLaunch, waitForRecording } from "./video";
import { inSession, isReady, newSession } from "./webdriver";

type StartApp = Extract<Command, { kind: "start-app" }>;
export type Save<S> = (next: S) => S;
type Prepared = {
  readonly home: string;
  readonly configDir: string;
  readonly repoDir: string;
  readonly binary: string;
};

const DISPLAY_READY_MS = 10_000;
export const DRIVER_READY_MS = 30_000;
const DISPLAY_NUMBER = /^[0-9]+\n/;

export function tempFolder(name: string): { folder: string; logDir: string } {
  if (readState(statePath(name)) !== null) {
    throw new Error(`a session named "${name}" exists; stop it first`);
  }
  const folder = mkdtempSync(join(tmpdir(), `${TEMP_PREFIX}${name}-`));
  const logDir = join(folder, "logs");
  mkdirSync(logDir);
  return { folder, logDir };
}

function privateConfig(folder: string): { home: string; configDir: string } {
  const home = join(folder, "home");
  const configDir = join(home, ".config");
  mkdirSync(configDir, { recursive: true });
  const owners = [join(userInfo().homedir, ".config"), process.env["XDG_CONFIG_HOME"] ?? ""]
    .filter((path) => path !== "" && existsSync(path))
    .map((path) => realpathSync(path));
  const clash = ownerConfigClash(realpathSync(configDir), owners);
  if (clash !== null) {
    throw new Error(clash);
  }
  return { home, configDir };
}

function prepareApp(command: StartApp, folder: string): Prepared {
  const binary = fromRoot(command.binary);
  if (!existsSync(binary)) {
    throw new Error(`no app at ${binary}; build it with cargo tauri build --debug --no-bundle`);
  }
  const { home, configDir } = privateConfig(folder);
  if (command.settings !== null) {
    mkdirSync(join(configDir, "yamt"));
    writeFileSync(join(configDir, "yamt", "settings.json"), command.settings);
  }
  const repoDir = command.repo.kind === "dir" ? fromRoot(command.repo.dir) : join(folder, "repo");
  if (command.repo.kind === "fresh") {
    execFileSync(fromRoot("scripts/conflict-repo.sh"), [repoDir], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  }
  return { home, configDir, repoDir, binary };
}

function appEnv(display: number, prepared: Prepared): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...displayEnv(display),
    HOME: prepared.home,
    XDG_CONFIG_HOME: prepared.configDir,
  };
  for (const derived of ["XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME"]) {
    delete env[derived];
  }
  return env;
}

export async function launchTracked<S extends SessionState>(
  state: S,
  spec: Launch,
  save: Save<S>,
): Promise<{ state: S; child: ChildProcess }> {
  const { child, proc } = await launch(spec);
  return { state: save({ ...state, procs: [...state.procs, proc] }), child };
}

export async function withCleanup<S extends SessionState>(
  first: S,
  steps: (save: Save<S>) => Promise<S>,
): Promise<S> {
  let latest = first;
  function save(next: S): S {
    latest = next;
    writeState(statePath(next.name), next);
    return next;
  }
  save(first);
  try {
    return await steps(save);
  } catch (error) {
    await stopSession(latest);
    throw error;
  }
}

async function startDisplay(
  state: AppState,
  logDir: string,
  save: Save<AppState>,
): Promise<AppState> {
  const displayFile = join(logDir, "display");
  const { width, height } = state.size;
  const xvfb = await launchTracked(
    state,
    {
      role: "xvfb",
      command: "Xvfb",
      args: ["-displayfd", "3", "-screen", "0", `${width}x${height}x24`, "-nolisten", "tcp"],
      env: process.env,
      cwd: state.folder,
      logDir,
      fd3File: displayFile,
    },
    save,
  );
  await waitUntil(
    () => DISPLAY_NUMBER.test(readFileSync(displayFile, "utf8")),
    DISPLAY_READY_MS,
    "Xvfb",
  );
  return save({ ...xvfb.state, display: Number(readFileSync(displayFile, "utf8").trim()) });
}

async function startDriver(
  state: AppState,
  prepared: Prepared,
  logDir: string,
  save: Save<AppState>,
): Promise<AppState> {
  const driverPort = await freePort();
  const nativePort = await freePort();
  const driver = await launchTracked(
    { ...state, driverPort },
    {
      role: "tauri-driver",
      command: "tauri-driver",
      args: ["--port", String(driverPort), "--native-port", String(nativePort)],
      env: appEnv(state.display, prepared),
      cwd: state.folder,
      logDir,
      fd3File: null,
    },
    save,
  );
  await waitUntil(() => isReady(driverPort), DRIVER_READY_MS, "tauri-driver");
  return driver.state;
}

async function appSteps(
  empty: AppState,
  command: StartApp,
  prepared: Prepared,
  logDir: string,
  save: Save<AppState>,
): Promise<AppState> {
  let next = await startDisplay(empty, logDir, save);
  next = await startDriver(next, prepared, logDir, save);
  const record = command.record;
  const recorder =
    record === null ? null : await launchTracked(next, recordingLaunch(next, record, logDir), save);
  if (recorder !== null) {
    next = recorder.state;
    await waitForRecording(logDir);
  }
  const options = { application: prepared.binary, args: ["--repo", prepared.repoDir] };
  next = save({
    ...next,
    session: await newSession(next.driverPort, { "tauri:options": options }),
  });
  await inSession(next, "POST", "/window/rect", { x: 0, y: 0, ...command.size });
  if (recorder !== null && record !== null) {
    await finishRecording(recorder.child, record, logDir);
  }
  return next;
}

export async function startApp(command: StartApp): Promise<Readonly<Record<string, unknown>>> {
  const { folder, logDir } = tempFolder(command.name);
  let prepared: Prepared;
  try {
    prepared = prepareApp(command, folder);
  } catch (error) {
    rmSync(folder, { recursive: true, force: true });
    throw error;
  }
  const { configDir, repoDir } = prepared;
  const empty: AppState = {
    kind: "app",
    name: command.name,
    driverPort: 0,
    session: null,
    folder,
    size: command.size,
    procs: [],
    display: 0,
    configDir,
    repoDir,
  };
  const state = await withCleanup(empty, (save) =>
    appSteps(empty, command, prepared, logDir, save),
  );
  const { display, driverPort, session } = state;
  return {
    display: `:${display}`,
    driverPort,
    session,
    configDir,
    repoDir,
    record: command.record,
  };
}
