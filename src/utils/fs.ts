import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { assertSafeProjectWrite } from "./paths.js";

export const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const readTextFile = async (path: string): Promise<string> => readFile(path, "utf8");

export const writeProjectFile = async (
  cwd: string,
  path: string,
  content: string,
): Promise<void> => {
  assertSafeProjectWrite(cwd, path);
  const absolutePath = resolve(cwd, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
};

export const readJsonFile = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readTextFile(path)) as T;
  } catch {
    return null;
  }
};
