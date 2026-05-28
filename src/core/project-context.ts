import { join } from "node:path";

import type { PackageJson } from "../analyzers/package-json.js";
import { readPackageJson } from "../analyzers/package-json.js";
import type { ResolvedConfig } from "../rules/types.js";
import { findByGlob } from "../utils/glob.js";
import { resolveCwd } from "../utils/paths.js";

export interface ProjectContext {
  config: ResolvedConfig;
  cwd: string;
  files: string[];
  packageJson: PackageJson | null;
  packageJsonPath: string;
}

export const createProjectContext = async (
  cwdInput: string | undefined,
  config: ResolvedConfig,
): Promise<ProjectContext> => {
  const cwd = resolveCwd(cwdInput);
  const files = await findByGlob(config.include, { cwd, exclude: config.exclude });
  const packageJson = await readPackageJson(cwd);

  return {
    config,
    cwd,
    files,
    packageJson,
    packageJsonPath: join(cwd, "package.json"),
  };
};
