export function commandWords(text: string): readonly string[] {
  return text.split(" ").filter((word) => word !== "");
}
