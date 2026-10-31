// Copy the local CRM into an EMPTY hosted CRM. Never overwrites either database.
// Make and verify an encrypted backup first. Run with all local writers stopped.
import { PrismaClient } from "@prisma/client";
import { parseEnv } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { cloudEnvironment, cloudDatabase, cloudClient } from "./cloud-env.mjs";
const tables = ["users", "companies", "customers", "projects", "quotations", "quotation_items", "site_visits", "attachments", "notifications", "quotation_sequences", "project_preferences", "work_groups", "work_group_members", "work_group_messages", "invoice_sequences"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
let local, target, bucket, committed = false;
const uploaded = [];
try {
  const env = await cloudEnvironment(), source = parseEnv(await readFile(".env", "utf8"));
  if (!["localhost", "127.0.0.1"].includes(new URL(source.DATABASE_URL).hostname)) throw new Error("Local source required");
  target = new PrismaClient({ datasources: { db: { url: cloudDatabase(env).href } } });
  local = new PrismaClient({ datasources: { db: { url: source.DATABASE_URL } } });
  const client = cloudClient(env);
  const { data: config, error } = await client.storage.getBucket(env.SUPABASE_STORAGE_BUCKET);
  if (error || config.public) throw new Error("Private destination bucket required");
  bucket = client.storage.from(env.SUPABASE_STORAGE_BUCKET);
  await local.$transaction(async (sourceTx) => {
    await sourceTx.$executeRawUnsafe(`LOCK TABLE ${tables.map((name) => `public."${name}"`).join(",")} IN SHARE MODE NOWAIT`);
    await target.$transaction(async (destinationTx) => {
      await destinationTx.$executeRawUnsafe(`LOCK TABLE ${tables.map((name) => `public."${name}"`).join(",")} IN ACCESS EXCLUSIVE MODE NOWAIT`);
      for (const name of tables) {
        const [result] = await destinationTx.$queryRawUnsafe(`SELECT count(*)::int AS count FROM public."${name}"`);
        if (result.count !== 0) throw new Error("Hosted CRM must be empty");
      }
      for (const name of tables) {
        const rows = await sourceTx.$queryRawUnsafe(`SELECT * FROM public."${name}"`);
        if (name === "attachments") {
          const copies = new Map();
          const root = await realpath(source.UPLOAD_DIR || path.resolve(".local/uploads"));
          for (const row of rows) {
            if (copies.has(row.filepath)) { row.filepath = copies.get(row.filepath); continue; }
            const originalKey = row.filepath, file = await realpath(path.resolve(root, originalKey));
            if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile()) throw new Error("Unsafe local file");
            const bytes = await readFile(file);
            if (bytes.length !== row.filesize) throw new Error("Attachment size mismatch");
            const extension = path.extname(originalKey);
            if (!/^\.[a-z0-9]+$/.test(extension)) throw new Error("Invalid attachment extension");
            const key = `migration/${randomUUID()}${extension}`;
            const { error } = await bucket.upload(key, bytes, { contentType: row.mimetype, cacheControl: "0", upsert: false });
            if (error) throw error; uploaded.push(key);
            const { data, error: readError } = await bucket.download(key);
            if (readError || hash(Buffer.from(await data.arrayBuffer())) !== hash(bytes)) throw new Error("Cloud attachment integrity failed");
            row.filepath = `supabase/${key}`; copies.set(originalKey, row.filepath);
          }
        }
        // Challenges and throttle counters are deliberately not transferred.
        // Sign-out all copied sessions while preserving user/record ownership.
        if (name === "users") for (const user of rows) user.sessionVersion++;
        if (rows.length) await destinationTx.$executeRawUnsafe(`INSERT INTO public."${name}" SELECT * FROM json_populate_recordset(NULL::public."${name}", $1::json)`, JSON.stringify(rows));
        const [result] = await destinationTx.$queryRawUnsafe(`SELECT count(*)::int AS count FROM public."${name}"`);
        if (result.count !== rows.length) throw new Error("Cloud row count mismatch");
      }
    }, { timeout: 180000, maxWait: 5000 });
    committed = true;
  }, { timeout: 190000, maxWait: 5000 });
  console.log(`Cloud copy verified: ${tables.length} business tables and ${uploaded.length} private objects. Local records and files are unchanged. Review demo users before launch.`);
} catch {
  // A lost commit acknowledgement is ambiguous: never delete an object that
  // might already be referenced by a committed hosted row.
  if (!committed && bucket && target) for (const key of uploaded) {
    try { if (!await target.attachment.count({ where: { filepath: `supabase/${key}` } })) await bucket.remove([key]); } catch { /* Retain on uncertainty. */ }
  }
  console.error("Cloud copy did not finish. Check private configuration, empty destination, file integrity and connectivity. Existing local data was not changed."); process.exitCode = 1;
} finally { await local?.$disconnect(); await target?.$disconnect(); }
