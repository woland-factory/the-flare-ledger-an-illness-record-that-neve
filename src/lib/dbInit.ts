import fs from "node:fs";
import path from "node:path";
import { prisma, getPglite } from "./db";

// The migration SQL under prisma/migrations is the single source of truth for
// the schema. Real Postgres and PGlite both apply it here at startup, so the
// image needs no migration CLI. Developers author new migrations with
// `prisma migrate dev --create-only` (generate SQL, do not auto-apply); the
// app applies them on boot, recording each in app_migrations.

function migrationNames(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
    .sort();
}

function statements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function ensureSchema(): Promise<void> {
  const dir = path.join(process.cwd(), "prisma", "migrations");
  const names = migrationNames(dir);
  const pg = getPglite();

  if (pg) {
    await pg.exec(
      "CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());",
    );
    for (const name of names) {
      const done = await pg.query<{ name: string }>(
        "SELECT name FROM app_migrations WHERE name = $1",
        [name],
      );
      if (done.rows.length > 0) continue;
      const sql = fs.readFileSync(path.join(dir, name, "migration.sql"), "utf8");
      await pg.exec(sql);
      await pg.query("INSERT INTO app_migrations (name) VALUES ($1)", [name]);
    }
    return;
  }

  // The database may still be accepting connections a moment after the
  // container reports healthy, so retry the first query briefly.
  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      break;
    } catch (err) {
      if (attempt >= 10) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  await prisma.$executeRawUnsafe(
    "CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());",
  );
  for (const name of names) {
    const done = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM app_migrations WHERE name = $1",
      name,
    );
    if (done.length > 0) continue;
    const sql = fs.readFileSync(path.join(dir, name, "migration.sql"), "utf8");
    for (const stmt of statements(sql)) {
      await prisma.$executeRawUnsafe(stmt);
    }
    await prisma.$executeRawUnsafe("INSERT INTO app_migrations (name) VALUES ($1)", name);
  }
}
