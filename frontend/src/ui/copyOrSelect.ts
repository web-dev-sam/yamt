export async function copyOrSelect(text: string, element: Element | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (element !== null) {
      window.getSelection()?.selectAllChildren(element);
    }
    return false;
  }
}
