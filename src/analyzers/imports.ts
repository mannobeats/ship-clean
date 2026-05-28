import { dirname, extname, join, normalize } from "node:path";

import { init, parse } from "es-module-lexer";

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

const countLinesBefore = (content: string, index: number): number =>
  content.slice(0, index).split("\n").length;

export const scanModule = async (cwd: string, file: string): Promise<ModuleScan> => {
  await init;
  const content = await readTextFile(join(cwd, file));
  const [imports, exports] = parse(content);

  return {
    exports: exports.map((item) => ({
      line: countLinesBefore(content, item.s),
      name: item.n,
      type: item.n === "default" ? "default" : "named",
    })),
    imports: imports
      .filter((item) => item.n)
      .map((item) => {
        const statementStart = Math.max(0, item.ss);
        const statement = content.slice(statementStart, Math.max(item.se, item.e));
        return {
          isDynamic: item.d > -1,
          isTypeOnly: /^\s*import\s+type\b/u.test(statement),
          line: countLinesBefore(content, item.s),
          source: item.n ?? "",
        };
      }),
  };
};

export const resolveRelativeImport = (
  fromFile: string,
  source: string,
  files: string[],
): string | null => {
  if (!source.startsWith(".")) {
    return null;
  }

  const base = toPosixPath(normalize(join(dirname(fromFile), source)));
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
  if (!extname(base)) {
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
