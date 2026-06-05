import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

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
    expect(
      result.findings.some((finding) => finding.rule === "duplicates/no-duplicate-blocks"),
    ).toBe(true);
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
