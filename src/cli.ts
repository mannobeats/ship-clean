#!/usr/bin/env node
import { runCheckCommand } from "./commands/check.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runExplainCommand } from "./commands/explain.js";
import { runFixCommand } from "./commands/fix.js";
import { runInitCommand } from "./commands/init.js";
import { runListCommand } from "./commands/list.js";
import type { OutputFormat } from "./output/index.js";

interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

const parseArgs = (argv: string[]): ParsedArgs => {
  const [first, ...rest] = argv;
  const command = first && !first.startsWith("-") ? first : "check";
  const tokens = first && !first.startsWith("-") ? rest : argv;
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) {
      continue;
    }

    if (!token.startsWith("-")) {
      positional.push(token);
      continue;
    }

    const normalized = token.replace(/^--?/u, "");
    const [inlineKey, inlineValue] = normalized.split("=", 2);
    if (!inlineKey) {
      continue;
    }

    if (inlineValue !== undefined) {
      flags[inlineKey] = inlineValue;
      continue;
    }

    const next = tokens[index + 1];
    if (next && !next.startsWith("-")) {
      flags[inlineKey] = next;
      index += 1;
      continue;
    }

    flags[inlineKey] = true;
  }

  return { command, flags, positional };
};

const stringFlag = (flags: Record<string, string | boolean>, name: string): string | undefined => {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
};

const booleanFlag = (flags: Record<string, string | boolean>, name: string): boolean =>
  flags[name] === true || flags[name] === "true";

const printHelp = (): void => {
  process.stdout.write(`ship-clean

Usage:
  ship-clean check [--cwd <path>] [--json]
  ship-clean fix [--cwd <path>] [--unsafe]
  ship-clean init [--cwd <path>] [--force]
  ship-clean doctor [--cwd <path>]
  ship-clean explain <rule>
  ship-clean list [--cwd <path>]

`);
};

export const main = async (argv = process.argv.slice(2)): Promise<number> => {
  const parsed = parseArgs(argv);
  const cwd = stringFlag(parsed.flags, "cwd");
  const configPath = stringFlag(parsed.flags, "config");

  switch (parsed.command) {
    case "check":
      return runCheckCommand({
        configPath,
        cwd,
        format:
          booleanFlag(parsed.flags, "json") || parsed.flags.format === "json"
            ? "json"
            : ("terminal" satisfies OutputFormat),
      });
    case "fix":
      return runFixCommand({
        configPath,
        cwd,
        unsafe: booleanFlag(parsed.flags, "unsafe"),
      });
    case "init":
      return runInitCommand({
        cwd,
        force: booleanFlag(parsed.flags, "force"),
      });
    case "doctor":
      return runDoctorCommand({ cwd });
    case "explain":
      return runExplainCommand(parsed.positional[0] ?? "");
    case "list":
      return runListCommand({ cwd });
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return 0;
    default:
      process.stderr.write(`Unknown command: ${parsed.command}\n\n`);
      printHelp();
      return 1;
  }
};

if (!process.env.VITEST) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    },
  );
}
