import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import process from "node:process";

export const toPosixPath = (path: string): string => path.replaceAll("\\", "/");

export const resolveCwd = (cwd?: string): string => resolve(process.cwd(), cwd ?? ".");

export const relativePath = (cwd: string, path: string): string => toPosixPath(relative(cwd, path));

const realPathOrResolved = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

export const isInsidePath = (target: string, root: string): boolean => {
  const relativeTarget = relative(root, target);
  return relativeTarget === "" || (!relativeTarget.startsWith("..") && !isAbsolute(relativeTarget));
};

export const assertSafeProjectWrite = (cwd: string, target: string): void => {
  const resolvedRoot = resolve(cwd);
  const projectRoot = realPathOrResolved(resolvedRoot);
  const absoluteTarget = resolve(cwd, target);

  if (!isInsidePath(absoluteTarget, resolvedRoot)) {
    throw new Error(`Refusing to write outside project: ${target}`);
  }

  const parentPath = dirname(absoluteTarget);
  const realParentPath = realPathOrResolved(parentPath);
  if (!isInsidePath(realParentPath, projectRoot) && !isInsidePath(realParentPath, resolvedRoot)) {
    throw new Error(`Refusing to write through directory outside project: ${target}`);
  }

  try {
    const stats = lstatSync(absoluteTarget);
    if (stats.isSymbolicLink()) {
      throw new Error(`Refusing to write through symbolic link: ${target}`);
    }
    const realTargetPath = realPathOrResolved(absoluteTarget);
    if (!isInsidePath(realTargetPath, projectRoot)) {
      throw new Error(`Refusing to write outside project: ${target}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
};
