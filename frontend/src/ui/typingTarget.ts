const TEXT_INPUT_TYPES: Readonly<Record<string, true>> = {
  email: true,
  number: true,
  password: true,
  search: true,
  tel: true,
  text: true,
  url: true,
};

export function isTypingTarget(target: EventTarget | null): boolean {
  if (target === null || !("tagName" in target)) {
    return false;
  }
  switch (target.tagName) {
    case "TEXTAREA":
      return true;
    case "INPUT":
      return (
        "type" in target &&
        typeof target.type === "string" &&
        Object.hasOwn(TEXT_INPUT_TYPES, target.type)
      );
    default:
      return false;
  }
}
