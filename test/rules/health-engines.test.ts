import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { scanModule } from "../../src/analyzers/imports.js";
import { checkProject } from "../../src/core/runner.js";

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const tempDirs: string[] = [];

describe("health engines", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
  });

  it("reports graph and package health findings", async () => {
    const result = await checkProject({ cwd: fixture("health-project") });

    expect(result.findings.map((finding) => finding.rule)).toEqual(
      expect.arrayContaining([
        "graph/no-cycles",
        "graph/no-unused-files",
        "graph/no-unused-exports",
        "package/no-missing-dependencies",
        "package/no-unused-dependencies",
        "package/forbidden-dependencies",
      ]),
    );
  });

  it("reports duplicated code blocks", async () => {
    const result = await checkProject({ cwd: fixture("duplicates-project") });

    expect(result.summary.warnings).toBeGreaterThan(0);
    const duplicateFindings = result.findings.filter(
      (finding) => finding.rule === "duplicates/no-duplicate-blocks",
    );
    expect(duplicateFindings).toHaveLength(1);
    expect(duplicateFindings[0]?.actual).toContain("overlapping windows");
  });

  it("parses modern TypeScript and TSX module syntax for graph health", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ship-clean-oxc-parser-"));
    tempDirs.push(cwd);
    await mkdir(join(cwd, "src/app"), { recursive: true });
    await writeFile(
      join(cwd, "src/app/global-error.tsx"),
      [
        'import type { Metadata } from "next";',
        'export { runtime as edgeRuntime } from "./runtime";',
        'const Lazy = () => import("./lazy");',
        "export const metadata = { title: 'Fixture' } satisfies Metadata;",
        "export default function GlobalError({ error }: { error: Error }) {",
        "  return <html><body>{error.message}</body></html>;",
        "}",
      ].join("\n"),
    );

    const scan = await scanModule(cwd, "src/app/global-error.tsx");

    expect(scan.imports.map((item) => item.source)).toEqual(["next", "./runtime", "./lazy"]);
    expect(scan.imports.find((item) => item.source === "next")?.isTypeOnly).toBe(true);
    expect(scan.imports.find((item) => item.source === "./lazy")?.isDynamic).toBe(true);
    expect(scan.exports.map((item) => item.name)).toEqual(
      expect.arrayContaining(["edgeRuntime", "metadata", "default"]),
    );
  });

  it("materializes Biome config internally during lint checks", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ship-clean-biome-config-"));
    tempDirs.push(cwd);
    await mkdir(join(cwd, "src"), { recursive: true });
    await writeFile(join(cwd, "src/index.ts"), "export const value = 1;\n");
    await writeFile(
      join(cwd, "package.json"),
      '{"name":"biome-config-fixture","version":"1.0.0","type":"module"}\n',
    );
    await writeFile(
      join(cwd, "shipclean.config.json"),
      `${JSON.stringify(
        {
          duplicates: { enabled: false },
          graph: { enabled: false },
          include: ["src/**/*.ts"],
          lint: { enabled: true, engine: "biome", preset: "recommended" },
          package: { enabled: false },
          typescript: { enabled: false },
        },
        null,
        2,
      )}\n`,
    );

    const result = await checkProject({ cwd });
    const generatedConfig = await readFile(join(cwd, ".ship-clean/biome.generated.json"), "utf8");

    expect(result.engines.map((engine) => engine.engine)).toContain("biome");
    expect(generatedConfig).toContain("https://biomejs.dev/schemas/");
    expect(generatedConfig).toContain('"noUnusedImports"');
  });

  it("treats Next.js convention files as graph entrypoints", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ship-clean-next-graph-"));
    tempDirs.push(cwd);
    await mkdir(join(cwd, "src/app/dashboard"), { recursive: true });
    await mkdir(join(cwd, "src/lib"), { recursive: true });
    await writeFile(
      join(cwd, "src/app/layout.tsx"),
      "export default function Layout() { return null; }\n",
    );
    await writeFile(
      join(cwd, "src/app/dashboard/page.tsx"),
      "import { used } from '@/lib/used.input';\nexport default function Page() { return used; }\n",
    );
    await writeFile(join(cwd, "src/lib/used.input.ts"), "export const used = 'yes';\n");
    await writeFile(join(cwd, "src/lib/orphan.ts"), "export const orphan = 'no';\n");
    await writeFile(
      join(cwd, "package.json"),
      '{"name":"next-graph-fixture","version":"1.0.0","dependencies":{"next":"latest"}}\n',
    );
    await writeFile(
      join(cwd, "tsconfig.json"),
      '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}\n',
    );
    await writeFile(
      join(cwd, "shipclean.config.json"),
      `${JSON.stringify(
        {
          duplicates: { enabled: false },
          graph: { enabled: true, unusedExports: "off", unusedFiles: "warn" },
          include: ["src/**/*.{ts,tsx}"],
          lint: { enabled: false },
          package: {
            allowedUnusedDependencies: ["next"],
            enabled: true,
            missingDependencies: "warn",
            unusedDependencies: "warn",
          },
          typescript: { enabled: false },
        },
        null,
        2,
      )}\n`,
    );

    const result = await checkProject({ cwd });
    const unusedFiles = result.findings
      .filter((finding) => finding.rule === "graph/no-unused-files")
      .map((finding) => finding.file);

    expect(unusedFiles).not.toContain("src/app/layout.tsx");
    expect(unusedFiles).not.toContain("src/app/dashboard/page.tsx");
    expect(unusedFiles).toContain("src/lib/orphan.ts");
    expect(result.findings.some((finding) => finding.actual?.includes("@/lib"))).toBe(false);
  });

  it("does not report tool dependencies that are used through package scripts", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ship-clean-package-health-"));
    tempDirs.push(cwd);
    await mkdir(join(cwd, "src"));
    await writeFile(join(cwd, "src/index.ts"), 'import pc from "picocolors";\nconsole.log(pc);\n');
    await writeFile(
      join(cwd, "package.json"),
      `${JSON.stringify(
        {
          dependencies: {
            picocolors: "1.1.1",
          },
          devDependencies: {
            "@types/node": "25.9.1",
            "ship-clean": "0.1.0",
            tsx: "4.22.3",
            unused: "1.0.0",
          },
          name: "package-health-fixture",
          scripts: {
            check: "ship-clean check",
            dev: "tsx src/index.ts",
          },
          version: "1.0.0",
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(
      join(cwd, "shipclean.config.json"),
      `${JSON.stringify(
        {
          graph: { enabled: false },
          lint: { enabled: false },
          package: {
            enabled: true,
            missingDependencies: "error",
            unusedDependencies: "warn",
          },
          typescript: { enabled: false },
        },
        null,
        2,
      )}\n`,
    );

    const result = await checkProject({ cwd });
    const unusedDependencyFindings = result.findings.filter(
      (finding) => finding.rule === "package/no-unused-dependencies",
    );

    expect(unusedDependencyFindings.map((finding) => finding.message)).toEqual([
      'Remove unused dependency "unused" or add it to an allowlist later.',
    ]);
  });
});
