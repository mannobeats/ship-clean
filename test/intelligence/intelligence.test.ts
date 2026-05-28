import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { main } from "../../src/cli.js";
import { buildAgentContext } from "../../src/intelligence/context.js";
import { buildIntelligenceIndex } from "../../src/intelligence/indexer.js";
import { affectedFiles, impactForFile, searchIntelligence } from "../../src/intelligence/query.js";

const tempDirs: string[] = [];

const makeProject = async (): Promise<string> => {
  const cwd = await mkdtemp(join(tmpdir(), "ship-clean-intelligence-"));
  tempDirs.push(cwd);
  await mkdir(join(cwd, "src"), { recursive: true });
  await writeFile(
    join(cwd, "shipclean.config.json"),
    JSON.stringify({
      include: ["src/**/*.ts"],
      lint: { enabled: false },
      typescript: { enabled: false },
    }),
  );
  await writeFile(join(cwd, "package.json"), '{"name":"fixture","version":"1.0.0"}\n');
  await writeFile(
    join(cwd, "src/session.ts"),
    [
      "export interface Session {",
      "  id: string;",
      "}",
      "",
      "export function createSession(userId: string): Session {",
      "  return { id: userId };",
      "}",
      "",
      "export function destroySession(session: Session): string {",
      "  return session.id;",
      "}",
    ].join("\n"),
  );
  await writeFile(
    join(cwd, "src/auth.ts"),
    [
      'import { createSession } from "./session";',
      "",
      "export function login(userId: string) {",
      "  return createSession(userId);",
      "}",
    ].join("\n"),
  );
  await writeFile(
    join(cwd, "src/main.ts"),
    ['import { login } from "./auth";', "", 'export const session = login("u1");'].join("\n"),
  );
  return cwd;
};

describe("code intelligence", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
  });

  it("indexes, searches, builds context, and traces affected files", async () => {
    const cwd = await makeProject();
    const index = await buildIntelligenceIndex({ cwd });

    expect(index.stats.fileCount).toBe(3);
    expect(index.stats.symbolCount).toBeGreaterThanOrEqual(5);
    expect(index.stats.edgeCount).toBe(2);

    const persisted = JSON.parse(
      await readFile(join(cwd, ".ship-clean/intelligence.json"), "utf8"),
    );
    expect(persisted.stats.fileCount).toBe(3);

    const results = searchIntelligence(index, "createSession");
    expect(results[0]?.symbol.name).toBe("createSession");

    const context = await buildAgentContext(cwd, index, "createSession login flow");
    expect(context).toContain("Ship Clean Code Context");
    expect(context).toContain("createSession");
    expect(context).toContain("src/session.ts:5");

    const impact = impactForFile(index, "src/session.ts");
    expect(impact.dependents).toContain("src/auth.ts");

    expect(affectedFiles(index, ["src/session.ts"])).toEqual([
      "src/auth.ts",
      "src/main.ts",
      "src/session.ts",
    ]);
  });

  it("exposes intelligence through CLI commands", async () => {
    const cwd = await makeProject();
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await expect(main(["index", "--cwd", cwd])).resolves.toBe(0);
    await expect(main(["search", "createSession", "--cwd", cwd])).resolves.toBe(0);
    await expect(main(["context", "createSession login", "--cwd", cwd])).resolves.toBe(0);
    await expect(main(["impact", "src/session.ts", "--cwd", cwd, "--json"])).resolves.toBe(0);
    await expect(main(["affected", "src/session.ts", "--cwd", cwd, "--json"])).resolves.toBe(0);

    const output = stdout.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("ship-clean intelligence index");
    expect(output).toContain("createSession");
    expect(output).toContain("src/auth.ts");
  });
});
