import type { Theme } from "../ipc";
import type { MergeRequests } from "./mergeRequests";
import type { Screen } from "./screen";

/** The screen a compare or range window opens on: `--mr` asks for its merge-request page. */
export type StartScreen = Extract<Screen["kind"], "files" | "mergeRequests">;

export type WindowStart = { readonly theme: Theme; readonly screen: StartScreen };

export function startScreenOf(open: string | null | undefined): StartScreen {
  return open === "mergeRequests" ? "mergeRequests" : "files";
}

export async function openAtStart(
  mergeRequests: MergeRequests,
  screen: StartScreen,
): Promise<void> {
  await mergeRequests.findProject();
  if (screen === "mergeRequests" && mergeRequests.project.value.kind === "found") {
    mergeRequests.show();
  }
}
