import type { Direction } from "./navigation";

export type WheelSum = {
  readonly direction: Direction;
  readonly px: number;
  readonly at: number;
} | null;

type Wheel = Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY" | "timeStamp">;

export const WHEEL_STEP_PX = 100;
export const WHEEL_IDLE_MS = 250;

const DOM_DELTA_PIXEL = 0;

export function wheelStep(
  sum: WheelSum,
  { deltaMode, deltaX, deltaY, timeStamp }: Wheel,
): { sum: WheelSum; step: Direction | null } {
  if (deltaY === 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
    return { sum, step: null };
  }
  const direction = deltaY > 0 ? "down" : "up";
  if (deltaMode !== DOM_DELTA_PIXEL) {
    return { sum: null, step: direction };
  }
  const sameBurst =
    sum !== null && sum.direction === direction && timeStamp - sum.at <= WHEEL_IDLE_MS;
  if (!sameBurst) {
    return { sum: { direction, px: 0, at: timeStamp }, step: direction };
  }
  const px = sum.px + Math.abs(deltaY);
  return px >= WHEEL_STEP_PX
    ? { sum: { direction, px: 0, at: timeStamp }, step: direction }
    : { sum: { direction, px, at: timeStamp }, step: null };
}
