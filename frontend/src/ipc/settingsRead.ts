import type * as Generated from "./bindings";
import type { SettingsRead } from "./domain";

export function toSettingsRead(dto: Generated.SettingsRead): SettingsRead {
  const { languageServers } = dto.stored;
  const stored = {
    ...dto.stored,
    languageServers: { ...languageServers, off: languageServers.off ?? {} },
  };
  return { path: dto.path, defaultPath: dto.default_path, stored };
}
