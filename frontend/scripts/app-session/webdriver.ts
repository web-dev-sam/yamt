import { isRecord, recordOf, stringField } from "./json";
import type { SessionState } from "./state";

type Method = "GET" | "POST" | "DELETE";

export async function webdriver(
  port: number,
  method: Method,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  const value = isRecord(payload) ? payload["value"] : undefined;
  if (!response.ok) {
    const detail = isRecord(value)
      ? `${String(value["error"])}: ${String(value["message"])}`
      : `HTTP ${response.status}`;
    throw new Error(`webdriver ${method} ${path}: ${detail}`);
  }
  return value;
}

export async function isReady(port: number): Promise<boolean> {
  try {
    const status = await webdriver(port, "GET", "/status");
    return isRecord(status) && status["ready"] === true;
  } catch {
    return false;
  }
}

export async function newSession(
  port: number,
  capabilities: Readonly<Record<string, unknown>>,
): Promise<string> {
  const value = await webdriver(port, "POST", "/session", {
    capabilities: { alwaysMatch: capabilities },
  });
  return stringField(recordOf(value, "new session"), "sessionId");
}

export async function inSession(
  state: SessionState,
  method: Method,
  path: string,
  body?: unknown,
): Promise<unknown> {
  if (state.session === null) {
    throw new Error(`session "${state.name}" has no WebDriver session`);
  }
  return webdriver(state.driverPort, method, `/session/${state.session}${path}`, body);
}

export async function execute(
  state: SessionState,
  script: string,
  args: readonly unknown[],
): Promise<unknown> {
  return inSession(state, "POST", "/execute/sync", { script, args });
}

export async function perform(state: SessionState, actions: readonly unknown[]): Promise<void> {
  await inSession(state, "POST", "/actions", { actions });
  // WebKitWebDriver (WebKitGTK 2.54) measures a wheel delta from the source's previous scroll
  // until the input state is released; observed: deltaY 10 after 40 fired a wheel of -30.
  await inSession(state, "DELETE", "/actions");
}
