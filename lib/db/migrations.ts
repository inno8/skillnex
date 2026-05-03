/**
 * Schema migration runner for the SQLite database.
 *
 * Each migration is a numbered .sql file in lib/db/migrations/.
 * The runner records applied migrations in a `_migrations` table
 * (created on first run) and applies any new ones in order, idempotently.
 *
 * Migrations are append-only — once applied, never modified. To change a
 * schema, add a new migration that ALTERs or migrates data forward.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import type Database from "better-sqlite3";

// Anchor on the project root, not __dirname — under Next.js + Turbopack
// __dirname resolves to a bundled output path that has no migrations on disk.
const MIGRATIONS_DIR = resolve(process.cwd(), "lib", "db", "migrations");

const META_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS _migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;

export type AppliedMigration = {
  id: string;
  applied_at: string;
};

export function listAppliedMigrations(db: Database.Database): AppliedMigration[] {
  db.exec(META_TABLE_DDL);
  return db
    .prepare("SELECT id, applied_at FROM _migrations ORDER BY id")
    .all() as AppliedMigration[];
}

export function listAvailableMigrations(): { id: string; sql: string }[] {
  let entries: string[];
  try {
    entries = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  } catch {
    return [];
  }
  entries.sort();
  return entries.map((file) => ({
    id: file.replace(/\.sql$/, ""),
    sql: readFileSync(join(MIGRATIONS_DIR, file), "utf-8"),
  }));
}

export type MigrationResult = {
  applied: string[];
  skipped: string[];
};

/**
 * Apply any unapplied migrations in order. Wraps each one in a transaction
 * so a failure rolls back cleanly.
 */
export function migrate(db: Database.Database): MigrationResult {
  db.exec(META_TABLE_DDL);
  const applied = new Set(listAppliedMigrations(db).map((m) => m.id));
  const available = listAvailableMigrations();

  const justApplied: string[] = [];
  const skipped: string[] = [];

  for (const { id, sql } of available) {
    if (applied.has(id)) {
      skipped.push(id);
      continue;
    }
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO _migrations (id, applied_at) VALUES (?, ?)",
      ).run(id, new Date().toISOString());
    });
    try {
      tx();
      justApplied.push(id);
    } catch (err) {
      throw new Error(
        `Migration ${id} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { applied: justApplied, skipped };
}
