#!/usr/bin/env node
import { runCheckCommand } from "./commands/check.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runExplainCommand } from "./commands/explain.js";
import { runFixCommand } from "./commands/fix.js";
import { runInitCommand } from "./commands/init.js";
import { type InitSelection, projectTypes, strictnessLevels } from "./commands/init-config.js";
import {
  runAffectedCommand,
  runContextCommand,
  runImpactCommand,
  runIndexCommand,
  runSearchCommand,
  runStudioCommand,
  runSyncCommand,
  runWatchCommand,
} from "./commands/intelligence.js";
import { runListCommand } from "./commands/list.js";
import type { OutputFormat } from "./output/index.js";

interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

const parseArgs = (argv: string[]): ParsedArgs => {
  const [first, ...rest] = argv;
  if (first === "--help" || first === "-h") {
    return { command: "help", flags: {}, positional: [] };
  }
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

const numberFlag = (flags: Record<string, string | boolean>, name: string): number | undefined => {
  const value = stringFlag(flags, name);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name} value "${value}". Expected a positive integer.`);
  }
  return parsed;
};

const projectTypeFlag = (
  flags: Record<string, string | boolean>,
): InitSelection["projectType"] | undefined => {
  const value = stringFlag(flags, "project");
  if (!value) {
    return undefined;
  }
  if (projectTypes.includes(value as InitSelection["projectType"])) {
    return value as InitSelection["projectType"];
  }
  throw new Error(
    `Invalid --project value "${value}". Expected one of: ${projectTypes.join(", ")}`,
  );
};

const strictnessFlag = (
  flags: Record<string, string | boolean>,
): InitSelection["strictness"] | undefined => {
  const value = stringFlag(flags, "strictness");
  if (!value) {
    return undefined;
  }
  if (strictnessLevels.includes(value as InitSelection["strictness"])) {
    return value as InitSelection["strictness"];
  }
  throw new Error(
    `Invalid --strictness value "${value}". Expected one of: ${strictnessLevels.join(", ")}`,
  );
};

const printHelp = (): void => {
  process.stdout.write(`ship-clean

Usage:
  ship-clean check [--cwd <path>] [--json]
  ship-clean fix [--cwd <path>] [--unsafe]
  ship-clean init [--cwd <path>] [--force] [--yes] [--project <type>] [--strictness <level>]
  ship-clean doctor [--cwd <path>]
  ship-clean explain <rule>
  ship-clean list [--cwd <path>]
  ship-clean index [--cwd <path>]
  ship-clean sync [--cwd <path>] [--json]
  ship-clean watch [--cwd <path>]
  ship-clean studio [--cwd <path>] [--port <number>]
  ship-clean search <query> [--cwd <path>] [--json]
  ship-clean context <task> [--cwd <path>]
  ship-clean impact <file> [--cwd <path>] [--json]
  ship-clean affected <files...> [--cwd <path>] [--json]

Init:
  --project       ${projectTypes.join(" | ")}
  --strictness    ${strictnessLevels.join(" | ")}
  --yes           Generate default config without prompts

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
    case "init": {
      const projectType = projectTypeFlag(parsed.flags);
      const strictness = strictnessFlag(parsed.flags);
      return runInitCommand({
        cwd,
        force: booleanFlag(parsed.flags, "force"),
        nonInteractive:
          booleanFlag(parsed.flags, "yes") || booleanFlag(parsed.flags, "non-interactive"),
        ...(projectType ? { projectType } : {}),
        ...(strictness ? { strictness } : {}),
      });
    }
    case "doctor":
      return runDoctorCommand({ cwd });
    case "explain":
      return runExplainCommand(parsed.positional[0] ?? "");
    case "list":
      return runListCommand({ cwd });
    case "index":
      return runIndexCommand({ configPath, cwd });
    case "sync":
      return runSyncCommand({
        configPath,
        cwd,
        json: booleanFlag(parsed.flags, "json") || parsed.flags.format === "json",
      });
    case "watch":
      return runWatchCommand({ configPath, cwd });
    case "studio":
      return runStudioCommand({ configPath, cwd, port: numberFlag(parsed.flags, "port") });
    case "search":
      return runSearchCommand(parsed.positional.join(" "), {
        cwd,
        json: booleanFlag(parsed.flags, "json") || parsed.flags.format === "json",
      });
    case "context":
      return runContextCommand(parsed.positional.join(" "), { cwd });
    case "impact":
      return runImpactCommand(parsed.positional[0] ?? "", {
        cwd,
        json: booleanFlag(parsed.flags, "json") || parsed.flags.format === "json",
      });
    case "affected":
      return runAffectedCommand(parsed.positional, {
        cwd,
        json: booleanFlag(parsed.flags, "json") || parsed.flags.format === "json",
      });
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
