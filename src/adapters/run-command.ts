import spawn from "cross-spawn";

export interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

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
