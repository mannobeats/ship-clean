import { join } from "node:path";

import { readJsonFile } from "../utils/fs.js";

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  type?: string;
  version?: string;
  workspaces?: string[] | { packages?: string[] };
}

export const readPackageJson = async (cwd: string): Promise<PackageJson | null> =>
  readJsonFile<PackageJson>(join(cwd, "package.json"));

export const collectDependencyNames = (pkg: PackageJson | null): Set<string> => {
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    for (const name of Object.keys(pkg?.[field] ?? {})) {
      names.add(name);
    }
  }
  return names;
};
