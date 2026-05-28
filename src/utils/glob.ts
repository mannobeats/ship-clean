import { glob } from "tinyglobby";

import { toPosixPath } from "./paths.js";

export interface GlobOptions {
  cwd: string;
  exclude?: string[];
  onlyDirectories?: boolean;
}

export const findByGlob = async (patterns: string[], options: GlobOptions): Promise<string[]> => {
  const entries = await glob(patterns, {
    absolute: false,
    cwd: options.cwd,
    dot: false,
    ignore: options.exclude ?? [],
    onlyDirectories: options.onlyDirectories ?? false,
  });

  return entries.map(toPosixPath).sort();
};

export const matchesAny = async (
  path: string,
  patterns: string[],
  cwd: string,
  exclude: string[] = [],
): Promise<boolean> => {
  if (patterns.length === 0) {
    return false;
  }
  const matches = await findByGlob(patterns, { cwd, exclude });
  return matches.includes(toPosixPath(path));
};
