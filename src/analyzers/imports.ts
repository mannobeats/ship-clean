import { dirname, extname, join, normalize } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import {
  type DynamicImport,
  parseSync,
  type StaticExportEntry,
  type StaticImport,
} from "oxc-parser";

import { readTextFile } from "../utils/fs.js";
import { toPosixPath } from "../utils/paths.js";

export interface ImportRecord {
  isDynamic: boolean;
  isTypeOnly: boolean;
  line: number;
  source: string;
}

export interface ExportRecord {
  line: number;
  name: string;
  type: "default" | "named";
}

export interface ModuleScan {
  exports: ExportRecord[];
  imports: ImportRecord[];
}

export interface PathAlias {
  pattern: string;
  targets: string[];
}

interface TsConfigLike {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

const countLinesBefore = (content: string, index: number): number =>
  content.slice(0, index).split("\n").length;

const stringValueFromSpan = (content: string, start: number, end: number): string | null => {
  const raw = content.slice(start, end).trim();
  if (raw.length < 2) {
    return null;
  }
  const quote = raw[0];
  if ((quote !== '"' && quote !== "'" && quote !== "`") || raw.at(-1) !== quote) {
    return null;
  }
  return raw.slice(1, -1);
};

const importLine = (content: string, item: StaticImport | DynamicImport): number =>
  countLinesBefore(content, item.start);

const exportLine = (content: string, item: StaticExportEntry): number =>
  countLinesBefore(content, item.start);

export const scanModule = async (cwd: string, file: string): Promise<ModuleScan> => {
  const content = await readTextFile(join(cwd, file));
  const parsed = parseSync(file, content, {
    sourceType: "unambiguous",
  });

  const imports: ImportRecord[] = parsed.module.staticImports.map((item) => ({
    isDynamic: false,
    isTypeOnly: item.entries.length > 0 && item.entries.every((entry) => entry.isType),
    line: importLine(content, item),
    source: item.moduleRequest.value,
  }));

  for (const item of parsed.module.staticExports) {
    for (const entry of item.entries) {
      if (!entry.moduleRequest) {
        continue;
      }
      imports.push({
        isDynamic: false,
        isTypeOnly: entry.isType,
        line: exportLine(content, entry),
        source: entry.moduleRequest.value,
      });
    }
  }

  for (const item of parsed.module.dynamicImports) {
    const source = stringValueFromSpan(content, item.moduleRequest.start, item.moduleRequest.end);
    if (!source) {
      continue;
    }
    imports.push({
      isDynamic: true,
      isTypeOnly: false,
      line: importLine(content, item),
      source,
    });
  }

  const exports: ExportRecord[] = parsed.module.staticExports.flatMap((item) =>
    item.entries.flatMap((entry): ExportRecord[] => {
      if (entry.exportName.kind === "Default") {
        return [
          {
            line: exportLine(content, entry),
            name: "default",
            type: "default" as const,
          },
        ];
      }
      if (entry.exportName.name) {
        return [
          {
            line: exportLine(content, entry),
            name: entry.exportName.name,
            type: "named" as const,
          },
        ];
      }
      return [];
    }),
  );

  return {
    exports,
    imports,
  };
};

const resolveCandidatePath = (sourcePath: string, files: string[]): string | null => {
  const base = toPosixPath(normalize(sourcePath));
  const candidates = new Set<string>();
  candidates.add(base);

  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"];
  if (base.endsWith(".js")) {
    candidates.add(`${base.slice(0, -3)}.ts`);
    candidates.add(`${base.slice(0, -3)}.tsx`);
  }
  if (base.endsWith(".jsx")) {
    candidates.add(`${base.slice(0, -4)}.tsx`);
  }
  const sourceExtension = extname(base);
  if (!sourceExtension || !extensions.includes(sourceExtension)) {
    for (const extension of extensions) {
      candidates.add(`${base}${extension}`);
    }
    for (const extension of extensions) {
      candidates.add(`${base}/index${extension}`);
    }
  }

  for (const file of files) {
    if (candidates.has(file)) {
      return file;
    }
  }

  return null;
};

export const resolveRelativeImport = (
  fromFile: string,
  source: string,
  files: string[],
): string | null => {
  if (!source.startsWith(".")) {
    return null;
  }

  return resolveCandidatePath(join(dirname(fromFile), source), files);
};

const matchAliasPattern = (pattern: string, source: string): string | null => {
  const starIndex = pattern.indexOf("*");
  if (starIndex === -1) {
    return pattern === source ? "" : null;
  }

  const prefix = pattern.slice(0, starIndex);
  const suffix = pattern.slice(starIndex + 1);
  if (!source.startsWith(prefix) || !source.endsWith(suffix)) {
    return null;
  }
  return source.slice(prefix.length, source.length - suffix.length);
};

const applyAliasTarget = (target: string, matched: string): string =>
  target.includes("*") ? target.replace("*", matched) : target;

export const loadPathAliases = async (cwd: string): Promise<PathAlias[]> => {
  try {
    const raw = await readTextFile(join(cwd, "tsconfig.json"));
    const tsconfig = parseJsonc(raw) as TsConfigLike;
    const baseUrl = tsconfig.compilerOptions?.baseUrl ?? ".";
    const paths = tsconfig.compilerOptions?.paths ?? {};

    return Object.entries(paths).map(([pattern, targets]) => ({
      pattern,
      targets: targets.map((target) => toPosixPath(normalize(join(baseUrl, target)))),
    }));
  } catch {
    return [];
  }
};

export const resolveImport = (
  fromFile: string,
  source: string,
  files: string[],
  aliases: PathAlias[] = [],
): string | null => {
  if (source.startsWith(".")) {
    return resolveRelativeImport(fromFile, source, files);
  }

  for (const alias of aliases) {
    const matched = matchAliasPattern(alias.pattern, source);
    if (matched === null) {
      continue;
    }
    for (const target of alias.targets) {
      const resolved = resolveCandidatePath(applyAliasTarget(target, matched), files);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
};
