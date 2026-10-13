import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";

import type { Recording } from "./args";
import {
  collapseRows,
  countColours,
  feedFrames,
  frameBytes,
  framesWithMatch,
  type Colour,
} from "./colours";
import { logFile, run, waitUntil, type Launch } from "./processes";
import { displayEnv, fromRoot } from "./session";
import type { AppState } from "./state";

const FRAMES_PER_SECOND = 60;
const RECORDING_READY_MS = 10_000;
const RECORDING_GRACE_MS = 30_000;
const MS_PER_SECOND = 1000;

function grab(state: AppState): string[] {
  return [
    "-f",
    "x11grab",
    "-video_size",
    `${state.size.width}x${state.size.height}`,
    "-i",
    `:${state.display}`,
  ];
}

export function recordingLaunch(state: AppState, recording: Recording, logDir: string): Launch {
  return {
    role: "ffmpeg",
    command: "ffmpeg",
    args: [
      "-nostdin",
      "-y",
      "-framerate",
      String(FRAMES_PER_SECOND),
      ...grab(state),
      "-t",
      String(recording.seconds),
      "-c:v",
      "ffv1",
      fromRoot(recording.file),
    ],
    env: displayEnv(state.display),
    cwd: state.folder,
    logDir,
    fd3File: null,
  };
}

export async function waitForRecording(logDir: string): Promise<void> {
  await waitUntil(
    () => readFileSync(logFile(logDir, "ffmpeg"), "utf8").includes("Output #0"),
    RECORDING_READY_MS,
    "the recording to start",
  );
}

export async function finishRecording(
  child: ChildProcess,
  recording: Recording,
  logDir: string,
): Promise<void> {
  await waitUntil(
    () => child.exitCode !== null || child.signalCode !== null,
    recording.seconds * MS_PER_SECOND + RECORDING_GRACE_MS,
    "the recording to end",
  );
  if (child.exitCode !== 0) {
    throw new Error(`the recording failed; see ${logFile(logDir, "ffmpeg")}`);
  }
}

export async function displayShot(state: AppState, file: string): Promise<void> {
  await run(
    "ffmpeg",
    ["-loglevel", "error", "-y", ...grab(state), "-frames:v", "1", file],
    displayEnv(state.display),
  );
}

async function videoSize(file: string): Promise<{ width: number; height: number }> {
  const probe = [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=p=0",
    file,
  ];
  const [width, height] = (await run("ffprobe", probe, process.env)).trim().split(",").map(Number);
  if (width === undefined || height === undefined || !(width > 0 && height > 0)) {
    throw new Error(`${file}: no video size from ffprobe`);
  }
  return { width, height };
}

async function countPerFrame(
  file: string,
  frame: Uint8Array,
  colours: readonly Colour[],
): Promise<number[][]> {
  const decoder = spawn(
    "ffmpeg",
    ["-loglevel", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const closed = once(decoder, "close");
  let stderr = "";
  decoder.stderr.setEncoding("utf8").on("data", (text: string) => {
    stderr += text;
  });
  const perFrame: number[][] = [];
  let filled = 0;
  for await (const chunk of decoder.stdout) {
    if (chunk instanceof Uint8Array) {
      filled = feedFrames(frame, filled, chunk, (full) =>
        perFrame.push(countColours(full, colours)),
      );
    }
  }
  await closed;
  if (decoder.exitCode !== 0 || filled !== 0) {
    throw new Error(
      `decoding ${file} failed (${filled} bytes past the last whole frame): ${stderr.trim()}`,
    );
  }
  return perFrame;
}

function byHex(colours: readonly Colour[], values: readonly number[]): Record<string, number> {
  return Object.fromEntries(colours.map(({ hex }, i) => [hex, values[i] ?? 0]));
}

export async function colourTable(
  file: string,
  colours: readonly Colour[],
): Promise<Readonly<Record<string, unknown>>> {
  const { width, height } = await videoSize(file);
  const perFrame = await countPerFrame(file, new Uint8Array(frameBytes(width, height)), colours);
  return {
    file,
    size: `${width}x${height}`,
    frames: perFrame.length,
    table: collapseRows(perFrame).map((row) => ({
      frames: `${row.first}-${row.last}`,
      ...byHex(colours, row.counts),
    })),
    framesWithMatch: byHex(
      colours,
      colours.map((_, i) => framesWithMatch(perFrame, i)),
    ),
  };
}
