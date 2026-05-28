import { loadShipCleanConfig } from "../config/loader.js";
import { resolveCwd } from "../utils/paths.js";

export interface ListCommandOptions {
  cwd?: string | undefined;
}

export const runListCommand = async (options: ListCommandOptions): Promise<number> => {
  const cwd = resolveCwd(options.cwd);
  const config = await loadShipCleanConfig({ cwd });

  process.stdout.write("Engines\n");
  for (const [engine, enabled] of Object.entries(config.engines)) {
    process.stdout.write(`- ${engine}: ${enabled ? "on" : "off"}\n`);
  }

  process.stdout.write("\nRules\n");
  for (const rule of config.rules) {
    process.stdout.write(`- ${rule.name} (${rule.type})\n`);
  }

  return 0;
};
