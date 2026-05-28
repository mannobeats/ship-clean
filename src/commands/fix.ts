import { runBiomeFix } from "../adapters/biome.js";
import { runOxlintFix } from "../adapters/oxlint.js";
import { loadShipCleanConfig } from "../config/loader.js";
import { resolveCwd } from "../utils/paths.js";

export interface FixCommandOptions {
  configPath?: string | undefined;
  cwd?: string | undefined;
  unsafe?: boolean;
}

export const runFixCommand = async (options: FixCommandOptions): Promise<number> => {
  const cwd = resolveCwd(options.cwd);
  const config = await loadShipCleanConfig({
    ...(options.configPath ? { configPath: options.configPath } : {}),
    cwd,
  });
  let exitCode = 0;

  if (config.lint.enabled && config.lint.engine === "biome") {
    exitCode = Math.max(exitCode, runBiomeFix(cwd));
  }

  if (config.lint.enabled && config.lint.engine === "oxlint") {
    exitCode = Math.max(exitCode, runOxlintFix(cwd, options.unsafe ?? false));
  }

  return exitCode;
};
