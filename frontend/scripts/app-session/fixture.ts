import type { Command } from "./args";
import { freePort, launchTracked, waitUntil } from "./processes";
import { fromRoot } from "./session";
import { DRIVER_READY_MS, tempFolder, withCleanup } from "./start";
import type { FixtureState, Save } from "./state";
import { inSession, isReady, newSession } from "./webdriver";

type StartFixture = Extract<Command, { kind: "start-fixture" }>;

const DEV_SERVER_READY_MS = 60_000;
const MINIBROWSER = "/usr/lib/webkitgtk-6.0/MiniBrowser";

async function devServerUp(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function fixtureSteps(
  empty: FixtureState,
  command: StartFixture,
  logDir: string,
  save: Save<FixtureState>,
): Promise<FixtureState> {
  const common = { env: process.env, cwd: fromRoot("."), logDir, fd3File: null };
  const vitePort = await freePort();
  const devArgs = ["-C", "frontend", "dev", "--port", String(vitePort), "--strictPort"];
  const url = `http://localhost:${vitePort}/`;
  const vite = await launchTracked(
    { ...empty, url },
    { ...common, role: "vite", command: "pnpm", args: devArgs },
    save,
  );
  await waitUntil(() => devServerUp(url), DEV_SERVER_READY_MS, "the dev server");
  const driverPort = await freePort();
  const driverArgs = ["webdriver", String(driverPort)];
  const driver = await launchTracked(
    { ...vite.state, driverPort },
    { ...common, role: "webdriver", command: "just", args: driverArgs },
    save,
  );
  await waitUntil(() => isReady(driverPort), DRIVER_READY_MS, "WebKitWebDriver");
  const browser = { binary: MINIBROWSER, args: ["--automation"] };
  const capabilities = { browserName: "MiniBrowser", "webkitgtk:browserOptions": browser };
  const next = save({ ...driver.state, session: await newSession(driverPort, capabilities) });
  await inSession(next, "POST", "/url", { url: `${url}${command.search}` });
  await inSession(next, "POST", "/window/rect", command.size);
  return next;
}

export async function startFixture(
  command: StartFixture,
): Promise<Readonly<Record<string, unknown>>> {
  const { folder, logDir } = tempFolder(command.name);
  const empty: FixtureState = {
    kind: "fixture",
    name: command.name,
    driverPort: 0,
    session: null,
    folder,
    size: command.size,
    procs: [],
    url: "",
  };
  const state = await withCleanup(empty, (save) => fixtureSteps(empty, command, logDir, save));
  return { url: state.url, driverPort: state.driverPort, session: state.session };
}
