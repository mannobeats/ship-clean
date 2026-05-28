import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { checkProject } from "../../src/core/runner.js";

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

describe("native policy rules", () => {
  it("passes a clean fixture", async () => {
    const result = await checkProject({ cwd: fixture("clean-project") });

    expect(result.summary.errors).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it("reports export, file pattern, boundary, and dependency findings", async () => {
    const result = await checkProject({ cwd: fixture("dirty-project") });

    expect(result.summary.errors).toBe(3);
    expect(result.summary.warnings).toBe(1);
    expect(result.findings.map((finding) => finding.rule).sort()).toEqual([
      "components-no-lib",
      "no-barrels",
      "no-moment",
      "pages-export-default",
    ]);
  });
});
