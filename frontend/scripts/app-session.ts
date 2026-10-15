import { parseCommand, type Command } from "./app-session/args";
import { click, hover, press, read, scroll, shot, typeText } from "./app-session/drive";
import { startFixture } from "./app-session/fixture";
import { focusAway, focusBack } from "./app-session/focus";
import { sessionNamed, fromRoot } from "./app-session/session";
import { startApp } from "./app-session/start";
import { stopNamed } from "./app-session/stop";
import { colourTable } from "./app-session/video";

async function run(command: Command): Promise<unknown> {
  switch (command.kind) {
    case "start-app":
      return startApp(command);
    case "start-fixture":
      return startFixture(command);
    case "stop":
      return stopNamed(command.name);
    case "colours":
      return colourTable(fromRoot(command.file), command.colours);
    case "click":
      return click(sessionNamed(command.name), command);
    case "press":
      return press(sessionNamed(command.name), command);
    case "type":
      return typeText(sessionNamed(command.name), command);
    case "scroll":
      return scroll(sessionNamed(command.name), command);
    case "hover":
      return hover(sessionNamed(command.name), command);
    case "read":
      return read(sessionNamed(command.name), command);
    case "shot":
      return shot(sessionNamed(command.name), command);
    case "focus-away":
      return focusAway(sessionNamed(command.name));
    case "focus-back":
      return focusBack(sessionNamed(command.name));
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

if (import.meta.main) {
  const [, , ...argv] = process.argv;
  try {
    const output = await run(parseCommand(argv));
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) {
    process.stderr.write(
      `app-session: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
