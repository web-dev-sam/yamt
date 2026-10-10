import { getCurrentWindow } from "@tauri-apps/api/window";

export async function guardWindowClose(mayClose: () => Promise<boolean>): Promise<void> {
  await getCurrentWindow().onCloseRequested(async (event) => {
    if (!(await mayClose())) {
      event.preventDefault();
    }
  });
}
