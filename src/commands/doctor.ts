import { existsSync } from "node:fs";
import { join } from "node:path";

import { loadShipCleanConfig } from "../config/loader.js";
import { resolveCwd } from "../utils/paths.js";

export interface DoctorCommandOptions {
  cwd?: string | undefined;
}

export const runDoctorCommand = async (options: DoctorCommandOptions): Promise<number> => {
  const cwd = resolveCwd(options.cwd);
  const checks = [
    { name: "package.json", pass: existsSync(join(cwd, "package.json")) },
    { name: "shipclean config", pass: true },
  ];

  try {
    await loadShipCleanConfig({ cwd });
  } catch {
    checks[1] = { name: "shipclean config", pass: false };
  }

  for (const check of checks) {
    process.stdout.write(`${check.pass ? "✓" : "✗"} ${check.name}\n`);
  }

  return checks.every((check) => check.pass) ? 0 : 1;
};
