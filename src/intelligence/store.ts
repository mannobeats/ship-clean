import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { IntelligenceIndex, IntelligenceSymbolKind } from "./types.js";

export const intelligenceIndexPath = (cwd: string): string =>
  join(cwd, ".ship-clean", "intelligence.json");

export const intelligenceDbPath = (cwd: string): string =>
  join(cwd, ".ship-clean", "intelligence.sqlite");

export type IntelligenceStorageBackend = "json" | "sqlite";

export interface IntelligenceStorageStatus {
  backend: IntelligenceStorageBackend;
  dbPath: string;
  jsonPath: string;
  sqliteAvailable: boolean;
}

interface SqliteStatement {
  all(...params: unknown[]): Record<string, unknown>[];
  get(...params: unknown[]): Record<string, unknown> | undefined;
  run(...params: unknown[]): unknown;
}

interface SqliteDatabase {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  transaction<T extends () => void>(fn: T): T;
}

type SqliteConstructor = new (path: string) => SqliteDatabase;

interface BetterSqliteModule {
  default?: SqliteConstructor;
}

const loadSqliteConstructor = async (): Promise<SqliteConstructor | null> => {
  try {
    const loaded = (await import("better-sqlite3")) as BetterSqliteModule | SqliteConstructor;
    if (typeof loaded === "function") {
      const probe = new loaded(":memory:");
      probe.close();
      return loaded;
    }
    if (!loaded.default) {
      return null;
    }
    const probe = new loaded.default(":memory:");
    probe.close();
    return loaded.default;
  } catch {
    return null;
  }
};

const createSchema = (db: SqliteDatabase): void => {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      line_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS symbols (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      file TEXT NOT NULL,
      signature TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      exported INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS imports (
      file TEXT NOT NULL,
      source TEXT NOT NULL,
      target TEXT,
      line INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS symbols_file_idx ON symbols(file);
    CREATE INDEX IF NOT EXISTS imports_file_idx ON imports(file);
    CREATE INDEX IF NOT EXISTS imports_target_idx ON imports(target);

    CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
      id UNINDEXED,
      name,
      kind,
      file,
      signature
    );
  `);
};

const writeSqliteIndex = async (cwd: string, index: IntelligenceIndex): Promise<boolean> => {
  const Database = await loadSqliteConstructor();
  if (!Database) {
    return false;
  }

  let db: SqliteDatabase;
  try {
    db = new Database(intelligenceDbPath(cwd));
  } catch {
    return false;
  }
  try {
    createSchema(db);
    const write = db.transaction(() => {
      db.prepare("DELETE FROM metadata").run();
      db.prepare("DELETE FROM files").run();
      db.prepare("DELETE FROM symbols").run();
      db.prepare("DELETE FROM imports").run();
      db.prepare("DELETE FROM symbols_fts").run();

      const insertMeta = db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
      insertMeta.run("schemaVersion", String(index.schemaVersion));
      insertMeta.run("createdAt", index.createdAt);
      insertMeta.run("stats", JSON.stringify(index.stats));

      const insertFile = db.prepare("INSERT INTO files (path, line_count) VALUES (?, ?)");
      const insertSymbol = db.prepare(`
        INSERT INTO symbols (
          id,
          name,
          kind,
          file,
          signature,
          start_line,
          end_line,
          exported
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSymbolFts = db.prepare(`
        INSERT INTO symbols_fts (id, name, kind, file, signature)
        VALUES (?, ?, ?, ?, ?)
      `);
      const insertImport = db.prepare(`
        INSERT INTO imports (file, source, target, line)
        VALUES (?, ?, ?, ?)
      `);

      for (const file of index.files) {
        insertFile.run(file.path, file.lineCount);
        for (const symbol of file.symbols) {
          insertSymbol.run(
            symbol.id,
            symbol.name,
            symbol.kind,
            symbol.file,
            symbol.signature,
            symbol.startLine,
            symbol.endLine,
            symbol.exported ? 1 : 0,
          );
          insertSymbolFts.run(symbol.id, symbol.name, symbol.kind, symbol.file, symbol.signature);
        }
        for (const item of file.imports) {
          insertImport.run(file.path, item.source, item.target, item.line);
        }
      }
    });

    write();
    return true;
  } finally {
    db.close();
  }
};

const readString = (row: Record<string, unknown> | undefined, key: string): string | null => {
  const value = row?.[key];
  return typeof value === "string" ? value : null;
};

const readNumber = (row: Record<string, unknown>, key: string): number => {
  const value = row[key];
  return typeof value === "number" ? value : Number(value);
};

const readSqliteIndex = async (cwd: string): Promise<IntelligenceIndex | null> => {
  if (!existsSync(intelligenceDbPath(cwd))) {
    return null;
  }

  const Database = await loadSqliteConstructor();
  if (!Database) {
    return null;
  }

  let db: SqliteDatabase;
  try {
    db = new Database(intelligenceDbPath(cwd));
  } catch {
    return null;
  }
  try {
    createSchema(db);
    const createdAt = readString(
      db.prepare("SELECT value FROM metadata WHERE key = ?").get("createdAt"),
      "value",
    );
    const statsJson = readString(
      db.prepare("SELECT value FROM metadata WHERE key = ?").get("stats"),
      "value",
    );
    if (!createdAt || !statsJson) {
      return null;
    }

    const files = db
      .prepare("SELECT path, line_count FROM files ORDER BY path")
      .all()
      .map((fileRow) => {
        const path = readString(fileRow, "path") ?? "";
        return {
          imports: db
            .prepare(
              "SELECT source, target, line FROM imports WHERE file = ? ORDER BY line, source",
            )
            .all(path)
            .map((importRow) => ({
              line: readNumber(importRow, "line"),
              source: readString(importRow, "source") ?? "",
              target: readString(importRow, "target"),
            })),
          lineCount: readNumber(fileRow, "line_count"),
          path,
          symbols: db
            .prepare("SELECT * FROM symbols WHERE file = ? ORDER BY start_line, name")
            .all(path)
            .map((symbolRow) => ({
              endLine: readNumber(symbolRow, "end_line"),
              exported: readNumber(symbolRow, "exported") === 1,
              file: readString(symbolRow, "file") ?? path,
              id: readString(symbolRow, "id") ?? "",
              kind: (readString(symbolRow, "kind") ?? "constant") as IntelligenceSymbolKind,
              name: readString(symbolRow, "name") ?? "",
              signature: readString(symbolRow, "signature") ?? "",
              startLine: readNumber(symbolRow, "start_line"),
            })),
        };
      });

    return {
      createdAt,
      files,
      schemaVersion: 1,
      stats: JSON.parse(statsJson) as IntelligenceIndex["stats"],
    };
  } catch {
    return null;
  } finally {
    db.close();
  }
};

export const writeIntelligenceIndex = async (
  cwd: string,
  index: IntelligenceIndex,
): Promise<void> => {
  const path = intelligenceIndexPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await writeSqliteIndex(cwd, index);
  await writeFile(path, `${JSON.stringify(index, null, 2)}\n`);
};

export const readIntelligenceIndex = async (cwd: string): Promise<IntelligenceIndex | null> => {
  const sqliteIndex = await readSqliteIndex(cwd);
  if (sqliteIndex) {
    return sqliteIndex;
  }

  try {
    return JSON.parse(await readFile(intelligenceIndexPath(cwd), "utf8")) as IntelligenceIndex;
  } catch {
    return null;
  }
};

export const getIntelligenceStorageStatus = async (
  cwd: string,
): Promise<IntelligenceStorageStatus> => {
  const sqliteAvailable = (await loadSqliteConstructor()) !== null;
  return {
    backend: sqliteAvailable && existsSync(intelligenceDbPath(cwd)) ? "sqlite" : "json",
    dbPath: intelligenceDbPath(cwd),
    jsonPath: intelligenceIndexPath(cwd),
    sqliteAvailable,
  };
};
