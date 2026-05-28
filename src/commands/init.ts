import { createStarterConfig } from "../config/loader.js";
import { pathExists, writeProjectFile } from "../utils/fs.js";
import { resolveCwd } from "../utils/paths.js";

export interface InitCommandOptions {
  cwd?: string | undefined;
  force?: boolean;
}

export const runInitCommand = async (options: InitCommandOptions): Promise<number> => {
  const cwd = resolveCwd(options.cwd);
  const target = "shipclean.config.ts";
  if (!options.force && (await pathExists(`${cwd}/${target}`))) {
    throw new Error(`${target} already exists. Use --force to overwrite it.`);
  }

  await writeProjectFile(cwd, target, createStarterConfig());
  process.stdout.write(`Created ${target}\n`);
  return 0;
};
