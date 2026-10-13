const OPTION = "--";
const SESSION_NAME = /^[A-Za-z0-9_-]+$/;
const WHOLE_NUMBER = /^-?[0-9]+$/;

export type Spec = { readonly values: readonly string[]; readonly flags: readonly string[] };

export type Parsed = {
  readonly values: ReadonlyMap<string, string>;
  readonly flags: ReadonlySet<string>;
  readonly positionals: readonly string[];
};

export function splitArgs(argv: readonly string[], spec: Spec): Parsed {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const positionals: string[] = [];
  const queue = [...argv];
  let onlyPositionals = false;
  for (let arg = queue.shift(); arg !== undefined; arg = queue.shift()) {
    const option = arg.slice(OPTION.length);
    if (onlyPositionals || !arg.startsWith(OPTION)) {
      positionals.push(arg);
    } else if (arg === OPTION) {
      onlyPositionals = true;
    } else if (values.has(option) || flags.has(option)) {
      throw new Error(`${arg} given twice`);
    } else if (spec.flags.includes(option)) {
      flags.add(option);
    } else if (spec.values.includes(option)) {
      const value = queue.shift();
      if (value === undefined) {
        throw new Error(`${arg} needs a value`);
      }
      values.set(option, value);
    } else {
      throw new Error(`unknown option ${arg}`);
    }
  }
  return { values, flags, positionals };
}

export function sessionName(parsed: Parsed): string {
  const name = parsed.values.get("name");
  if (name === undefined) {
    throw new Error("--name <n> is required");
  }
  if (!SESSION_NAME.test(name)) {
    throw new Error(`--name ${name}: use letters, digits, "-" and "_" only`);
  }
  return name;
}

export function onePositional(parsed: Parsed, what: string): string {
  const [only, ...rest] = parsed.positionals;
  if (only === undefined || rest.length > 0) {
    const got = JSON.stringify(parsed.positionals);
    throw new Error(`expected exactly one ${what}, got ${parsed.positionals.length}: ${got}`);
  }
  return only;
}

export function noPositionals(parsed: Parsed): void {
  if (parsed.positionals.length > 0) {
    throw new Error(`unexpected arguments: ${JSON.stringify(parsed.positionals)}`);
  }
}

export function wholeNumber(text: string, what: string, least: number): number {
  const value = Number(text);
  if (!WHOLE_NUMBER.test(text) || value < least) {
    throw new Error(`${what} ${text}: expected a whole number ≥ ${least}`);
  }
  return value;
}
