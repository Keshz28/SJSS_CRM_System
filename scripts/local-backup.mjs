// Local-only complete backup and isolated restore rehearsal. Never restores over
// the application database. No passwords, keys or database URLs are printed.
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { decryptFile, encryptFile, encryptionKey, fileHash } from "./backup-crypto.mjs";

process.loadEnvFile(".env");
process.umask(0o077);
const command = process.argv[2], source = process.argv[3];
const local = path.resolve(".local"), backups = path.join(local, "backups");
const keyFile = path.resolve(process.env.BACKUP_KEY_FILE || path.join(local, "backup.key"));
let work, clusterStarted = false, prisma;
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
async function binary(name) {
  const dirs = [process.env.PG_BIN, "/opt/homebrew/opt/postgresql@17/bin", "/usr/local/opt/postgresql@17/bin", ...(process.env.PATH || "").split(path.delimiter)].filter(Boolean);
  for (const dir of dirs) { const file = path.join(dir, name); try { await access(file, 1); return file; } catch { /* try next */ } }
  throw new Error(`PostgreSQL tool ${name} is unavailable. Configure PG_BIN.`);
}
function connection(value) {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("Backup preparation is restricted to a local PostgreSQL database.");
  return { PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGSSLMODE: "disable" };
}
async function run(name, args, db = {}) {
  const executable = await binary(name);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { env: { PATH: process.env.PATH, LANG: "C", ...db }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", bytes = 0;
    child.stdout.on("data", (chunk) => { bytes += chunk.length; if (bytes > 8 * 1024 * 1024) child.kill(); else output += chunk; });
    // PostgreSQL errors can include connection/file details. Keep them private.
    child.stderr.resume();
    const timeout = setTimeout(() => child.kill(), 120_000);
    child.on("error", () => { clearTimeout(timeout); reject(new Error(`${name} could not start.`)); });
    child.on("close", (code) => { clearTimeout(timeout); code === 0 ? resolve(output) : reject(new Error(`${name} failed. Check local PostgreSQL availability, permissions and file integrity.`)); });
  });
}
async function checkedFile(root, key) {
  if (typeof key !== "string" || !key || path.isAbsolute(key) || key.split(/[\\/]/).includes("..")) throw new Error("Unsafe stored file key.");
  const file = path.resolve(root, key), actualRoot = await realpath(root), actual = await realpath(file);
  if (!actual.startsWith(actualRoot + path.sep) || !(await lstat(file)).isFile()) throw new Error("Stored files must be regular files inside private storage.");
  return file;
}
async function createBackup() {
  const db = connection(process.env.DIRECT_URL || process.env.DATABASE_URL);
  const app = connection(process.env.DATABASE_URL);
  if (["PGHOST", "PGPORT", "PGDATABASE"].some((key) => db[key] !== app[key])) throw new Error("The local application and backup database must match.");
  await mkdir(backups, { recursive: true, mode: 0o700 });
  const key = await encryptionKey(keyFile, true);
  work = await mkdtemp(path.join(backups, ".creating-"));
  await mkdir(path.join(work, "files"), { mode: 0o700 });
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(local, "uploads"));
  prisma = new PrismaClient();
  const manifest = { version: 1, createdAt: new Date().toISOString(), tables: [], files: [] };
  await prisma.$transaction(async (tx) => {
    const tables = await tx.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
    if (!tables.some((table) => table.tablename === "attachments")) throw new Error("The local CRM schema was not found.");
    // Briefly block writes so the database snapshot and attachment bytes agree.
    // NOWAIT fails rather than waiting behind someone's edit or migration.
    await tx.$executeRawUnsafe(`LOCK TABLE ${tables.map((table) => `public.${quote(table.tablename)}`).join(",")} IN SHARE MODE NOWAIT`);
    const [{ snapshot }] = await tx.$queryRaw`SELECT pg_export_snapshot() AS snapshot`;
    for (const table of tables) {
      const [{ count }] = await tx.$queryRawUnsafe(`SELECT count(*)::text AS count FROM public.${quote(table.tablename)}`);
      manifest.tables.push({ name: table.tablename, count });
    }
    const files = await tx.attachment.findMany({ select: { filepath: true, filesize: true } });
    for (const record of files) {
      if (manifest.files.some((file) => file.key === record.filepath)) continue;
      if (record.filepath.startsWith("uploads/")) throw new Error("Migrate legacy public uploads before taking a private backup.");
      const original = await checkedFile(uploadRoot, record.filepath);
      const plain = path.join(work, "attachment.tmp");
      await copyFile(original, plain);
      if ((await lstat(plain)).size !== record.filesize) throw new Error("An attachment is missing or its size does not match its record.");
      const entry = { key: record.filepath, object: `${manifest.files.length}.enc`, size: record.filesize, sha256: await fileHash(plain) };
      await encryptFile(plain, path.join(work, "files", entry.object), key);
      await rm(plain); manifest.files.push(entry);
    }
    const dump = path.join(work, "database.tmp");
    await run("pg_dump", ["--no-password", "--format=custom", "--no-owner", "--no-privileges", `--snapshot=${snapshot}`, `--file=${dump}`], db);
  }, { timeout: 180_000, maxWait: 5_000 });
  const dump = path.join(work, "database.tmp");
  manifest.databaseHash = await fileHash(dump);
  await encryptFile(dump, path.join(work, "database.enc"), key); await rm(dump);
  const metadata = path.join(work, "manifest.tmp");
  await writeFile(metadata, JSON.stringify(manifest), { mode: 0o600 });
  await encryptFile(metadata, path.join(work, "manifest.enc"), key); await rm(metadata);
  const target = path.join(backups, `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.sjss-backup`);
  await rename(work, target); work = undefined;
  console.log(`Encrypted backup created: ${path.relative(process.cwd(), target)}`);
  console.log(`Includes ${manifest.tables.length} tables and ${manifest.files.length} private files. Keep ${path.relative(process.cwd(), keyFile)} separately; losing the key makes the backup unusable.`);
}
async function rehearse() {
  if (!source) throw new Error("Usage: npm run backup:verify -- <backup-directory>");
  const key = await encryptionKey(keyFile);
  const root = path.resolve(source);
  if (!(await lstat(root)).isDirectory()) throw new Error("Choose a backup directory.");
  // Short private socket path; no TCP listener and no changes to the source DB.
  work = await mkdtemp("/tmp/sjss-restore-");
  const metadata = path.join(work, "manifest.json");
  await decryptFile(await checkedFile(root, "manifest.enc"), metadata, key);
  const manifest = JSON.parse(await readFile(metadata, "utf8"));
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !Array.isArray(manifest.tables) || !manifest.tables.length) throw new Error("Invalid backup manifest.");
  for (const table of manifest.tables) if (!/^[a-z_][a-z0-9_]*$/.test(table.name) || !/^\d+$/.test(table.count)) throw new Error("Invalid table manifest.");
  const dump = path.join(work, "database.dump");
  await decryptFile(await checkedFile(root, "database.enc"), dump, key);
  if (await fileHash(dump) !== manifest.databaseHash) throw new Error("Database backup integrity check failed.");
  const restored = path.join(work, "uploads"); await mkdir(restored, { mode: 0o700 });
  for (const [index, file] of manifest.files.entries()) {
    if (file.object !== `${index}.enc` || !/^[0-9a-f]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size)) throw new Error("Invalid file manifest.");
    const destination = path.join(restored, `${index}`);
    await decryptFile(await checkedFile(root, `files/${file.object}`), destination, key);
    if ((await lstat(destination)).size !== file.size || await fileHash(destination) !== file.sha256) throw new Error("Attachment integrity check failed.");
  }
  const data = path.join(work, "postgres"), socket = path.join(work, "socket");
  await mkdir(socket, { mode: 0o700 });
  await run("initdb", ["-D", data, "-U", "sjss_restore", "--auth-local=trust", "--auth-host=reject", "--encoding=UTF8", "--no-locale"]);
  await writeFile(path.join(data, "postgresql.auto.conf"), `listen_addresses = ''\nunix_socket_directories = '${socket.replaceAll("'", "''")}'\nport = 5432\n`, { mode: 0o600 });
  await run("pg_ctl", ["-D", data, "-l", path.join(work, "postgres.log"), "-w", "start"]); clusterStarted = true;
  const db = { PGHOST: socket, PGPORT: "5432", PGUSER: "sjss_restore", PGDATABASE: "postgres" };
  await run("pg_restore", ["--no-password", "--exit-on-error", "--single-transaction", "--no-owner", "--no-privileges", "--dbname=postgres", dump], db);
  for (const table of manifest.tables) {
    const count = (await run("psql", ["-XAt", "--no-password", "--set=ON_ERROR_STOP=1", "--command", `SELECT count(*) FROM public.${quote(table.name)}`], db)).trim();
    if (count !== table.count) throw new Error("Restored database row counts do not match the backup.");
  }
  const attachments = JSON.parse((await run("psql", ["-XAt", "--no-password", "--set=ON_ERROR_STOP=1", "--command", 'SELECT coalesce(json_agg(t),\'[]\'::json) FROM (SELECT DISTINCT filepath, filesize FROM attachments) t'], db)).trim());
  if (attachments.length !== manifest.files.length || attachments.some((record) => !manifest.files.some((file) => file.key === record.filepath && file.size === record.filesize))) throw new Error("Restored attachment references do not match the files.");
  console.log(`Restore rehearsal passed: ${manifest.tables.length} tables match, ${manifest.files.length} files authenticated and byte-verified. The application database was not changed.`);
}
try {
  if (command === "create") await createBackup();
  else if (command === "verify") await rehearse();
  else throw new Error("Choose create or verify.");
} catch (error) {
  // Prisma exceptions may contain full connection details, so show only our own
  // operational errors. All temporary plaintext is removed by the finally block.
  console.error(error.constructor === Error ? error.message : "Backup operation failed. Check the local database and private files; retry while no edits or migrations are running.");
  process.exitCode = 1;
} finally {
  if (clusterStarted) {
    try { await run("pg_ctl", ["-D", path.join(work, "postgres"), "-m", "fast", "-w", "stop"]); }
    catch { console.error("Could not stop the isolated restore server; its private directory was retained for cleanup."); process.exitCode = 1; work = undefined; }
  }
  if (work) await rm(work, { recursive: true, force: true });
  await prisma?.$disconnect();
}
