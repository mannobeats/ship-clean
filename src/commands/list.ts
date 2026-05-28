import { loadShipCleanConfig } from "../config/loader.js";
import { resolveCwd } from "../utils/paths.js";

export interface ListCommandOptions {
  cwd?: string | undefined;
}

export const runListCommand = async (options: ListCommandOptions): Promise<number> => {
  const cwd = resolveCwd(options.cwd);
  const config = await loadShipCleanConfig({ cwd });

  process.stdout.write("Quality systems\n");
  process.stdout.write(
    `- lint: ${config.lint.enabled ? `${config.lint.engine}/${config.lint.preset}` : "off"}\n`,
  );
  process.stdout.write(
    `- typescript: ${config.typescript.enabled ? config.typescript.mode : "off"}\n`,
  );
  process.stdout.write(`- graph: ${config.graph.enabled ? "on" : "off"}\n`);
  process.stdout.write(`- package: ${config.package.enabled ? "on" : "off"}\n`);
  process.stdout.write(`- duplicates: ${config.duplicates.enabled ? "on" : "off"}\n`);
  process.stdout.write(`- agent: ${config.agent.enabled ? "on" : "off"}\n`);

  process.stdout.write("\nRules\n");
  for (const rule of config.rules) {
    process.stdout.write(`- ${rule.name} (${rule.type})\n`);
  }

  return 0;
};
