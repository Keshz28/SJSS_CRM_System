import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { constants, createReadStream, createWriteStream } from "node:fs";
import { appendFile, open, rename, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

const magic = Buffer.from("SJSSBAK1");
export async function fileHash(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
export async function encryptionKey(file, create = false) {
  if (create) {
    let handle;
    try { handle = await open(file, "wx", 0o600); await handle.writeFile(randomBytes(32)); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    finally { await handle?.close(); }
  }
  // Refuse symlinks and keys readable by other users.
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || (info.mode & 0o077)) throw new Error("The backup key must be a private regular file (chmod 600).");
    const key = await handle.readFile();
    if (key.length !== 32) throw new Error("The backup key must contain exactly 32 bytes.");
    return key;
  } finally { await handle.close(); }
}
export async function encryptFile(source, destination, key) {
  const iv = randomBytes(12), header = Buffer.concat([magic, iv]);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(header);
  await pipeline(createReadStream(source), cipher, createWriteStream(destination, { flags: "wx", mode: 0o600 }));
  // Prefix a small versioned header without buffering the source file.
  const temp = `${destination}.header`;
  const output = createWriteStream(temp, { flags: "wx", mode: 0o600 });
  output.write(header);
  await pipeline(createReadStream(destination), output);
  await appendFile(temp, cipher.getAuthTag());
  await rename(temp, destination);
}
export async function decryptFile(source, destination, key) {
  const info = await stat(source), handle = await open(source, "r");
  const header = Buffer.alloc(20), tag = Buffer.alloc(16);
  try {
    if (info.size < 36) throw new Error("Invalid backup file.");
    await handle.read(header, 0, 20, 0); await handle.read(tag, 0, 16, info.size - 16);
  } finally { await handle.close(); }
  if (!header.subarray(0, 8).equals(magic)) throw new Error("Unsupported backup format.");
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(8));
  decipher.setAAD(header); decipher.setAuthTag(tag);
  // Plaintext is written only inside a private rehearsal directory. The caller
  // removes it on authentication failure, before any restore is attempted.
  const input = info.size === 36 ? [] : createReadStream(source, { start: 20, end: info.size - 17 });
  await pipeline(input, decipher, createWriteStream(destination, { flags: "wx", mode: 0o600 }));
}
