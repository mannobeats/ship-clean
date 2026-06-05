import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import spawn from "cross-spawn";

export interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

interface PackageMetadata {
  bin?: Record<string, string> | string;
}

const requireFromHere = createRequire(import.meta.url);

const parsePackageMetadata = (contents: string): PackageMetadata => {
  const parsed = JSON.parse(contents) as unknown;
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  const candidate = parsed as { bin?: unknown };
  if (typeof candidate.bin === "string") {
    return { bin: candidate.bin };
  }
  if (candidate.bin && typeof candidate.bin === "object" && !Array.isArray(candidate.bin)) {
    const bin: Record<string, string> = {};
    for (const [name, value] of Object.entries(candidate.bin)) {
      if (typeof value === "string") {
        bin[name] = value;
      }
    }
    return { bin };
  }
  return {};
};

export const resolvePackageBin = (packageName: string, binName: string): string => {
  const packageJsonPath = requireFromHere.resolve(`${packageName}/package.json`);
  const metadata = parsePackageMetadata(readFileSync(packageJsonPath, "utf8"));
  const binPath =
    typeof metadata.bin === "string" ? metadata.bin : (metadata.bin?.[binName] ?? null);

  if (!binPath) {
    throw new Error(`Package "${packageName}" does not expose a "${binName}" binary.`);
  }

  return join(dirname(packageJsonPath), binPath);
};

export const runCommand = (
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs?: number },
): CommandResult => {
  const result = spawn.sync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 60_000,
  });

  return {
    exitCode: typeof result.status === "number" ? result.status : 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
};

export const runPackageBin = (
  packageName: string,
  binName: string,
  args: string[],
  options: { cwd: string; timeoutMs?: number },
): CommandResult =>
  runCommand(process.execPath, [resolvePackageBin(packageName, binName), ...args], options);
