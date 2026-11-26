#!/usr/bin/env node
/**
 * Migrações locais com o motor de esquema WebAssembly oficial do Prisma
 * (@prisma/schema-engine-wasm) usando o driver adapter do Postgres.
 *
 * Existe porque, em alguns ambientes (como o sandbox onde o projeto foi criado),
 * o download do motor nativo de binaries.prisma.sh é bloqueado. Gera migrações
 * no MESMO formato de `prisma migrate dev` e grava a tabela _prisma_migrations,
 * então produção e CI continuam usando `prisma migrate deploy` normalmente.
 *
 * Uso:
 *   node --experimental-wasm-modules scripts/db-local.mjs create <nome>   # gera prisma/migrations/<ts>_<nome>/migration.sql
 *   node --experimental-wasm-modules scripts/db-local.mjs deploy          # aplica migrações pendentes em DATABASE_URL (driver pg)
 *   node --experimental-wasm-modules scripts/db-local.mjs reset           # apaga tudo e reaplica (só desenvolvimento/teste)
 *   node --experimental-wasm-modules scripts/db-local.mjs check           # falha se o schema e as migrações divergirem
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { SchemaEngine } from "@prisma/schema-engine-wasm";
import { PrismaPg } from "@prisma/adapter-pg";
import { bindMigrationAwareSqlAdapterFactory } from "@prisma/driver-adapter-utils";
import crypto from "node:crypto";
import pg from "pg";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const schemaDir = path.join(root, "prisma/schema");
const migrationsDir = path.join(root, "prisma/migrations");

function schemaFiles() {
  return fs
    .readdirSync(schemaDir)
    .filter((f) => f.endsWith(".prisma"))
    .sort()
    .map((f) => ({ path: path.join(schemaDir, f), content: fs.readFileSync(path.join(schemaDir, f), "utf8") }));
}

function migrationsList() {
  fs.mkdirSync(migrationsDir, { recursive: true });
  const lockPath = path.join(migrationsDir, "migration_lock.toml");
  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return {
    baseDir: migrationsDir,
    lockfile: { path: "migration_lock.toml", content: fs.existsSync(lockPath) ? fs.readFileSync(lockPath, "utf8") : null },
    shadowDbInitScript: "",
    migrationDirectories: dirs.map((name) => {
      const file = path.join(migrationsDir, name, "migration.sql");
      return {
        path: name,
        migrationFile: {
          path: "migration.sql",
          content: fs.existsSync(file) ? { tag: "ok", value: fs.readFileSync(file, "utf8") } : { tag: "error", value: "missing" },
        },
      };
    }),
  };
}

const filters = { externalTables: [], externalEnums: [] };

function factoryFor(url) {
  return bindMigrationAwareSqlAdapterFactory(new PrismaPg(url));
}

async function engineFor(url) {
  const datamodels = schemaFiles().map((f) => [f.path, f.content]);
  return SchemaEngine.new({ datamodels }, (log) => process.env.DEBUG_ENGINE && console.error(log), factoryFor(url));
}

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  return url;
}

/**
 * Diferença entre o schema da última migração e o schema atual.
 *
 * O motor wasm ainda não consegue descrever um banco Postgres "sombra" pelo driver adapter
 * (falha ao ler colunas do tipo "char" do catálogo). Por isso, cada migração criada aqui
 * guarda uma cópia do schema em prisma/schema-snapshots/<migração>.prisma, e o diff é
 * calculado entre esse snapshot e o schema atual. `check` também confere se a última
 * migração corresponde ao snapshot. No CI, com o motor nativo, `prisma migrate diff`
 * faz a verificação completa contra um banco real.
 */
const snapshotsDir = path.join(root, "prisma/schema-snapshots");

function lastSnapshot() {
  const dirs = migrationsList().migrationDirectories.map((d) => d.path);
  const last = dirs.at(-1);
  if (!last) return null;
  const file = path.join(snapshotsDir, `${last}.prisma`);
  if (!fs.existsSync(file)) throw new Error(`Snapshot ausente para a migração ${last}`);
  return { path: file, content: fs.readFileSync(file, "utf8") };
}

function combinedSchema() {
  return schemaFiles()
    .map((f) => `// ---- ${path.basename(f.path)} ----\n${f.content}`)
    .join("\n");
}

async function diffAgainstMigrations() {
  const eng = await engineFor(databaseUrl());
  const snap = lastSnapshot();
  const out = await eng.diff({
    from: snap ? { tag: "schemaDatamodel", files: [snap] } : { tag: "empty" },
    to: { tag: "schemaDatamodel", files: schemaFiles() },
    script: true,
    exitCode: true,
    filters,
  });
  return { changed: out.exitCode === 2, sql: out.stdout ?? "" };
}

/**
 * Aplica migrações pendentes com o driver pg (cada arquivo em uma transação, como script único)
 * e registra em _prisma_migrations no mesmo formato do Prisma (checksum = sha256 do arquivo),
 * para que `prisma migrate deploy` reconheça o histórico depois.
 */
async function applyPending(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`);
    const done = await client.query(`SELECT migration_name, checksum, finished_at FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`);
    const applied = new Map(done.rows.map((r) => [r.migration_name, r]));
    const names = [];
    for (const dir of migrationsList().migrationDirectories) {
      const sql = fs.readFileSync(path.join(migrationsDir, dir.path, "migration.sql"), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const prev = applied.get(dir.path);
      if (prev) {
        if (!prev.finished_at) throw new Error(`Migração ${dir.path} falhou anteriormente; resolva antes de continuar.`);
        if (prev.checksum !== checksum) throw new Error(`Migração ${dir.path} foi alterada depois de aplicada.`);
        continue;
      }
      const id = crypto.randomUUID();
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1,$2,$3,now(),1)`,
          [id, checksum, dir.path],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Falha ao aplicar ${dir.path}: ${err.message}`);
      }
      names.push(dir.path);
    }
    return names;
  } finally {
    await client.end();
  }
}

async function resetDatabase(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA public CASCADE");
    await client.query("CREATE SCHEMA public");
  } finally {
    await client.end();
  }
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

async function main() {
  const [cmd, name] = process.argv.slice(2);
  if (cmd === "create") {
    if (!name || !/^[a-z0-9_]+$/.test(name)) throw new Error("Informe um nome em snake_case");
    const { changed, sql } = await diffAgainstMigrations();
    if (!changed) {
      console.log("Nenhuma alteração no schema.");
    } else {
      const dirName = `${timestamp()}_${name}`;
      const dir = path.join(migrationsDir, dirName);
      fs.mkdirSync(dir, { recursive: true });
      const extra = path.join(root, "prisma/sql", `${name}.sql`);
      const tail = fs.existsSync(extra)
        ? `\n-- ==== SQL complementar (prisma/sql/${name}.sql) ====\n${fs.readFileSync(extra, "utf8")}`
        : "";
      fs.writeFileSync(path.join(dir, "migration.sql"), sql + tail);
      fs.mkdirSync(snapshotsDir, { recursive: true });
      fs.writeFileSync(path.join(snapshotsDir, `${dirName}.prisma`), combinedSchema());
      const lock = path.join(migrationsDir, "migration_lock.toml");
      if (!fs.existsSync(lock))
        fs.writeFileSync(
          lock,
          '# Please do not edit this file manually\n# It should be added in your version-control system (e.g., Git)\nprovider = "postgresql"\n',
        );
      console.log(`Migração criada: ${dirName}`);
    }
  } else if (cmd === "deploy") {
    const names = await applyPending(databaseUrl());
    console.log(names.length ? `Aplicadas: ${names.join(", ")}` : "Banco já está atualizado.");
  } else if (cmd === "reset") {
    if (process.env.NODE_ENV === "production") throw new Error("reset bloqueado em produção");
    await resetDatabase(databaseUrl());
    const names = await applyPending(databaseUrl());
    console.log(`Banco recriado. Aplicadas: ${names.join(", ") || "nenhuma"}`);
  } else if (cmd === "check") {
    const { changed, sql } = await diffAgainstMigrations();
    if (changed) {
      console.error("Schema e migrações divergem. Rode: pnpm db:migrate:create <nome>\n" + sql);
      process.exit(2);
    }
    console.log("Schema e migrações estão sincronizados.");
  } else {
    console.error("Comandos: create <nome> | deploy | reset | check");
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
