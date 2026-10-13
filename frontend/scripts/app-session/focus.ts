import { logsFolder } from "./folders";
import { launchTracked, run, stopProc } from "./processes";
import { appSession, displayEnv } from "./session";
import { saveState, type SessionState } from "./state";

const FOCUS_ROLE = "focus-window";
const FOCUS_CLASS = "yamt-app-session-focus";
const APP_TITLE = "yamt$";

async function firstWindow(args: readonly string[], env: NodeJS.ProcessEnv): Promise<string> {
  const [window] = (await run("xdotool", ["search", "--onlyvisible", ...args], env))
    .trim()
    .split("\n");
  if (window === undefined || window === "") {
    throw new Error(`no visible window for xdotool search ${args.join(" ")}`);
  }
  return window;
}

export async function focusAway(state: SessionState): Promise<Readonly<Record<string, unknown>>> {
  const app = appSession(state, "focus-away");
  if (app.procs.some(({ role }) => role === FOCUS_ROLE)) {
    throw new Error("focus is already away; run focus-back first");
  }
  const env = displayEnv(app.display);
  await launchTracked(
    app,
    {
      role: FOCUS_ROLE,
      command: "xmessage",
      args: ["-name", FOCUS_CLASS, "-geometry", "+0+0", "focus away"],
      env,
      cwd: app.folder,
      logDir: logsFolder(app.folder),
      fd3File: null,
    },
    saveState,
  );
  const window = await firstWindow(["--sync", "--classname", FOCUS_CLASS], env);
  await run("xdotool", ["windowfocus", "--sync", window], env);
  return { focused: "xmessage", window };
}

export async function focusBack(state: SessionState): Promise<Readonly<Record<string, unknown>>> {
  const app = appSession(state, "focus-back");
  const env = displayEnv(app.display);
  const window = await firstWindow(["--name", APP_TITLE], env);
  await run("xdotool", ["windowfocus", "--sync", window], env);
  const away = app.procs.filter(({ role }) => role === FOCUS_ROLE);
  for (const proc of away) {
    await stopProc(proc);
  }
  saveState({ ...app, procs: app.procs.filter((proc) => !away.includes(proc)) });
  return { focused: "app", window };
}
