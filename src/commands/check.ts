import { checkProject } from "../core/runner.js";
import { formatResult, type OutputFormat } from "../output/index.js";

export interface CheckCommandOptions {
  configPath?: string | undefined;
  cwd?: string | undefined;
  format?: OutputFormat;
}

export const runCheckCommand = async (options: CheckCommandOptions): Promise<number> => {
  const result = await checkProject({
    ...(options.configPath ? { configPath: options.configPath } : {}),
    ...(options.cwd ? { cwd: options.cwd } : {}),
  });
  process.stdout.write(formatResult(result, options.format ?? "terminal"));
  return result.summary.errors > 0 ? 1 : 0;
};
