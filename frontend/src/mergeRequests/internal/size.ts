type ChangeSize = {
  readonly additions: number;
  readonly deletions: number;
  readonly files: number;
};

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function sizeText(size: ChangeSize): string {
  return `+${size.additions} \u2212${size.deletions} · ${counted(size.files, "file", "files")}`;
}

export function sizeTitle(size: ChangeSize): string {
  const added = counted(size.additions, "line added", "lines added");
  return `${added}, ${size.deletions} removed in ${counted(size.files, "file", "files")}`;
}
