import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { main } from "../../src/cli.js";

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

describe("cli", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns zero for clean projects", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await expect(main(["check", "--cwd", fixture("clean-project"), "--json"])).resolves.toBe(0);
  });

  it("returns one for dirty projects", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await expect(main(["check", "--cwd", fixture("dirty-project"), "--json"])).resolves.toBe(1);
  });
});
