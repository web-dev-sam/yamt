type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, string | number | boolean>;

export interface LogEntry {
  level: LogLevel;
  event: string;
  fields: LogFields;
}

type LogForward = (entry: LogEntry) => Promise<unknown> | void;

type Log = Record<LogLevel, (event: string, fields?: LogFields) => void>;

function formatFields(fields: LogFields): string {
  const parts = Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `{${parts.join(", ")}}`;
}

function mirror(entry: LogEntry): void {
  const line = `[${entry.level}] ${entry.event} ${formatFields(entry.fields)}`;
  switch (entry.level) {
    case "debug":
      console.debug(line);
      return;
    case "info":
      console.info(line);
      return;
    case "warn":
      console.warn(line);
      return;
    case "error":
      console.error(line);
      return;
    default: {
      const _exhaustive: never = entry.level;
      return _exhaustive;
    }
  }
}

function reportForwardFailure(error: unknown): void {
  const reason = error instanceof Error ? error.message : typeof error;
  mirror({ level: "error", event: "log.forward_failed", fields: { reason } });
}

export function createLog(forward?: LogForward): Log {
  function emit(level: LogLevel, event: string, fields: LogFields = {}): void {
    const entry: LogEntry = { level, event, fields };
    mirror(entry);
    if (forward === undefined || (level === "debug" && !import.meta.env.DEV)) {
      return;
    }
    try {
      forward(entry)?.catch(reportForwardFailure);
    } catch (error) {
      reportForwardFailure(error);
    }
  }
  return {
    debug: (event, fields) => emit("debug", event, fields),
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
  };
}
