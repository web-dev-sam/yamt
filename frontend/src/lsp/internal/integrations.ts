import { joined, present } from "./ecosystems";
import { hasConfig, type Project } from "./project";
import type { Integration } from "./tool";

export const PHPACTOR_INTEGRATIONS: readonly Integration[] = [
  {
    key: "language_server_phpstan.enabled",
    bin: "vendor/bin/phpstan",
    configs: ["phpstan.neon", "phpstan.neon.dist", "phpstan.dist.neon"],
    formats: false,
  },
  {
    key: "language_server_psalm.enabled",
    bin: "vendor/bin/psalm",
    configs: ["psalm.xml", "psalm.xml.dist"],
    formats: false,
  },
  {
    key: "language_server_php_cs_fixer.enabled",
    bin: "vendor/bin/php-cs-fixer",
    configs: [".php-cs-fixer.php", ".php-cs-fixer.dist.php"],
    formats: true,
  },
  {
    key: "php_code_sniffer.enabled",
    bin: "vendor/bin/phpcs",
    configs: [".phpcs.xml", "phpcs.xml", ".phpcs.xml.dist", "phpcs.xml.dist"],
    formats: true,
  },
];

export function integrationFiles(integrations: readonly Integration[]): readonly string[] {
  return integrations.flatMap(({ bin, configs }) => [bin, ...configs]);
}

export function integrationsOn(
  project: Project,
  integrations: readonly Integration[],
): readonly Integration[] {
  return integrations.filter(
    ({ bin, configs }) =>
      present(project.files.get(joined(project.folder, bin))) && hasConfig(project, configs),
  );
}
