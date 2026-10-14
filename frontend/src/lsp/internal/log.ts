export type LogLine = {
  readonly at: number;
  readonly source: "stderr" | "server" | "yamt";
  readonly text: string;
};

const LOG_LINES = 2000;

export class LogBook {
  readonly #lines = new Map<string, LogLine[]>();

  add(name: string, line: LogLine): void {
    const lines = this.#lines.get(name) ?? [];
    lines.push(line);
    lines.splice(0, lines.length - LOG_LINES);
    this.#lines.set(name, lines);
  }

  lines(name: string): readonly LogLine[] {
    return [...(this.#lines.get(name) ?? [])];
  }
}
