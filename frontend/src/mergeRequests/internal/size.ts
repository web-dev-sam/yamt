type ChangeSize = {
  readonly additions: number;
  readonly deletions: number;
  readonly files: number;
};

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

type SizeParts = {
  readonly added: string;
  readonly removed: string;
  readonly files: string;
};

export function sizeParts(size: ChangeSize): SizeParts {
  return {
    added: `+${size.additions}`,
    removed: `\u2212${size.deletions}`,
    files: counted(size.files, "file", "files"),
  };
}

export function sizeTitle(size: ChangeSize): string {
  const added = counted(size.additions, "line added", "lines added");
  return `${added}, ${size.deletions} removed in ${counted(size.files, "file", "files")}`;
}
