import { existsSync } from "node:fs";
import { join } from "node:path";

export type PackageManagerName = "bun" | "npm" | "pnpm" | "yarn";

export const detectPackageManager = (cwd: string): PackageManagerName => {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) {
    return "bun";
  }
  if (existsSync(join(cwd, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
};

export const runScriptCommand = (packageManager: PackageManagerName, script: string): string => {
  if (packageManager === "npm") {
    return `npm run ${script}`;
  }
  return `${packageManager} ${script}`;
};
