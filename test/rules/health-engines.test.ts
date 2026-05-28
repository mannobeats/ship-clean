import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkProject } from "../../src/core/runner.js";

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

describe("health engines", () => {
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
});
