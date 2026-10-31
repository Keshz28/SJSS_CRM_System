// Emits one atomic bootstrap for an EMPTY dedicated cloud project, using the
// exact checked-in Prisma migrations and checksums. Never use on an existing CRM.
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const migrations = (await readdir("prisma/migrations", { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
let sql = `CREATE TABLE public._prisma_migrations (
  id varchar(36) PRIMARY KEY NOT NULL, checksum varchar(64) NOT NULL,
  finished_at timestamptz, migration_name varchar(255) NOT NULL, logs text,
  rolled_back_at timestamptz, started_at timestamptz NOT NULL DEFAULT now(),
  applied_steps_count integer NOT NULL DEFAULT 0
);\n`;
for (const name of migrations) {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error("Invalid migration name");
  const source = await readFile(`prisma/migrations/${name}/migration.sql`, "utf8");
  sql += source + `\nINSERT INTO public._prisma_migrations (id,checksum,migration_name,finished_at,applied_steps_count) VALUES (gen_random_uuid()::text,'${createHash("sha256").update(source).digest("hex")}','${name}',now(),1);\n`;
}
sql += await readFile("scripts/cloud-hardening.sql", "utf8");
process.stdout.write(sql);
